import { promises as fs } from "fs";
import path from "path";
import log from "electron-log";
import paths from "../utils/paths.js";
import { buildArchive, extractArchive, writeArchiveFiles } from "./archive.js";
import { encrypt, decrypt } from "./crypto.js";
import { createSupabaseAdapter } from "./adapters/supabase.js";
import {
  BACKUP_EXTENSION,
  DEFAULT_RETENTION,
  makeBackupName,
  selectStaleBackups,
} from "./naming.js";
import {
  getPassphrase,
  getSupabaseSession,
  saveSupabaseSession,
} from "./secureBackupStore.js";

/**
 * Couche d'abstraction de la sauvegarde en ligne.
 * Surface publique stable pour les handlers IPC ; le fournisseur (Supabase)
 * est isolé derrière un adaptateur, comme `einvoiceApi/index.js`.
 */

// Réexport des helpers purs (nommage / rétention) pour la surface publique.
export { makeBackupName, selectStaleBackups } from "./naming.js";

const ADAPTER_FACTORIES = {
  supabase: createSupabaseAdapter,
};

let cachedAdapter = null;
let cachedKey = null;

/**
 * Récupère (et met en cache) l'adaptateur de sauvegarde pour la config courante.
 * @param {Object} config - configuration complète (loadConfig)
 * @returns {Object} adapter
 */
export function getAdapter(config) {
  const backup = (config && config.backup) || {};
  const provider = backup.provider || "supabase";
  const factory = ADAPTER_FACTORIES[provider];
  if (!factory) {
    throw new Error(`Fournisseur de sauvegarde non supporté : ${provider}`);
  }

  const key = `${provider}:${backup.supabaseUrl || ""}:${backup.bucket || ""}`;
  if (cachedAdapter && cachedKey === key) return cachedAdapter;

  cachedAdapter = factory({
    url: backup.supabaseUrl,
    anonKey: backup.anonKey,
    bucket: backup.bucket,
    getSession: getSupabaseSession,
    saveSession: saveSupabaseSession,
  });
  cachedKey = key;
  return cachedAdapter;
}

/** À appeler quand la config de sauvegarde change (force la recréation). */
export function resetAdapterCache() {
  cachedAdapter = null;
  cachedKey = null;
}

// ============================================================
// Opérations
// ============================================================

/**
 * Connecte l'utilisateur à Supabase et persiste la session.
 * @param {Object} config
 * @param {string} email
 * @param {string} password
 */
export async function signIn(config, email, password) {
  resetAdapterCache();
  const adapter = getAdapter(config);
  return adapter.signInWithPassword(email, password);
}

/** Vérifie que la config + la session permettent d'accéder au bucket. */
export async function testConnection(config) {
  return getAdapter(config).testAccess();
}

/** Liste les sauvegardes distantes (plus récentes d'abord). */
export async function listBackups(config) {
  const items = await getAdapter(config).listBackups();
  return items
    .filter((it) => it.name.endsWith(BACKUP_EXTENSION))
    .sort((a, b) => (a.name < b.name ? 1 : -1));
}

/**
 * Sauvegarde complète : archive → chiffre → upload → purge (rétention).
 *
 * @param {Object} config
 * @param {Date} [now] - injectable pour les tests (défaut : maintenant)
 * @returns {Promise<{ name: string, size: number, createdAt: string, pruned: number }>}
 */
export async function runBackup(config, now = new Date()) {
  const passphrase = await getPassphrase();
  if (!passphrase) {
    throw new Error(
      "Aucune phrase de récupération définie. Configurez la sauvegarde dans les Paramètres.",
    );
  }

  const adapter = getAdapter(config);

  const archive = await buildArchive(paths.DATA_DIR);
  const blob = encrypt(archive, passphrase);
  const name = makeBackupName(now);

  await adapter.uploadBackup(name, blob);
  log.info(`Backup uploaded: ${name} (${blob.length} bytes)`);

  // Purge des anciennes archives (rétention).
  let pruned = 0;
  try {
    const retention = (config.backup && config.backup.retention) || DEFAULT_RETENTION;
    const existing = await adapter.listBackups();
    const stale = selectStaleBackups(existing, retention);
    if (stale.length > 0) {
      await adapter.removeBackups(stale);
      pruned = stale.length;
      log.info(`Pruned ${pruned} old backup(s)`);
    }
  } catch (err) {
    // La purge est secondaire : un échec ne doit pas invalider la sauvegarde.
    log.warn("Backup pruning failed (non-fatal):", err.message);
  }

  return { name, size: blob.length, createdAt: now.toISOString(), pruned };
}

/**
 * Copie de sécurité locale du dossier data/ avant une restauration destructive.
 * @returns {Promise<string>} chemin de la copie
 */
export async function snapshotCurrentData(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const dest = path.join(
    path.dirname(paths.DATA_DIR),
    `data-before-restore-${stamp}`,
  );
  await fs.cp(paths.DATA_DIR, dest, { recursive: true });
  log.info(`Local safety snapshot created at ${dest}`);
  return dest;
}

/**
 * Restaure une sauvegarde : télécharge → déchiffre → réécrit data/.
 * Opération destructive : une copie de sécurité locale est faite au préalable.
 *
 * @param {Object} config
 * @param {string} name - nom de l'archive distante
 * @param {Object} [opts] - { passphrase } pour restaurer sur un PC neuf
 * @returns {Promise<{ restored: number, safetyCopy: string, createdAt: string }>}
 */
export async function restoreBackup(config, name, opts = {}) {
  const passphrase = opts.passphrase || (await getPassphrase());
  if (!passphrase) {
    throw new Error("Phrase de récupération requise pour restaurer.");
  }

  const adapter = getAdapter(config);
  const blob = await adapter.downloadBackup(name);
  return applyEncryptedArchive(blob, passphrase, name);
}

/**
 * Restaure une sauvegarde depuis un fichier .fbak importé manuellement.
 * Ne nécessite NI connexion NI configuration Supabase : utile pour repartir
 * sur un ordinateur neuf à partir d'un fichier copié (clé USB, téléchargement).
 *
 * @param {string} filePath - chemin absolu du fichier .fbak
 * @param {Object} [opts] - { passphrase }
 * @returns {Promise<{ restored: number, safetyCopy: string, createdAt: string }>}
 */
export async function restoreFromFile(filePath, opts = {}) {
  const passphrase = opts.passphrase || (await getPassphrase());
  if (!passphrase) {
    throw new Error("Phrase de récupération requise pour restaurer.");
  }
  const blob = await fs.readFile(filePath);
  return applyEncryptedArchive(blob, passphrase, filePath);
}

/**
 * Cœur commun de la restauration : déchiffre → extrait → copie de sécurité →
 * réécrit data/. Opération destructive (protégée par le snapshot local).
 *
 * @param {Buffer} blob - archive chiffrée (.fbak)
 * @param {string} passphrase
 * @param {string} label - pour le journal (nom distant ou chemin fichier)
 */
async function applyEncryptedArchive(blob, passphrase, label) {
  const archive = decrypt(blob, passphrase); // lève si mauvaise phrase
  const manifest = extractArchive(archive);

  const safetyCopy = await snapshotCurrentData();
  await writeArchiveFiles(manifest.files, paths.DATA_DIR);
  log.info(`Restored ${manifest.fileCount} file(s) from ${label}`);

  return {
    restored: manifest.fileCount,
    safetyCopy,
    createdAt: manifest.createdAt,
  };
}
