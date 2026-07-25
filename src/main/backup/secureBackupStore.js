import { safeStorage } from "electron";
import { promises as fs } from "fs";
import path from "path";
import paths from "../utils/paths.js";
import log from "electron-log";

/**
 * Stockage local chiffré des secrets de sauvegarde, via `safeStorage`
 * (chiffrement lié à la machine — DPAPI sous Windows). Même approche que
 * `secureCredentials.js` pour les identifiants PDP.
 *
 * Contenu :
 *   - `passphrase` : la phrase de récupération, mise en cache pour permettre
 *     les sauvegardes automatiques SANS re-saisie. Elle reste par ailleurs
 *     connue de l'utilisateur (indispensable pour restaurer sur un PC neuf).
 *   - `supabase` : { refreshToken, userId } — la session d'authentification.
 *
 * Ce fichier n'est JAMAIS inclus dans une sauvegarde (cf. archive.js) : il est
 * lié à la machine et n'aurait aucune valeur ailleurs.
 */

const FILE_NAME = "backup-secrets.enc";

function getStorePath() {
  return path.join(paths.DATA_DIR, FILE_NAME);
}

function ensureEncryptionAvailable() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "Le chiffrement sécurisé n'est pas disponible sur ce poste (safeStorage). " +
        "Impossible de stocker les secrets de sauvegarde de manière sûre.",
    );
  }
}

async function readStore() {
  ensureEncryptionAvailable();
  try {
    const buffer = await fs.readFile(getStorePath());
    return JSON.parse(safeStorage.decryptString(buffer));
  } catch (err) {
    if (err.code === "ENOENT") return {};
    log.error("Failed to read backup secrets:", err);
    throw new Error("Impossible de lire les secrets de sauvegarde chiffrés");
  }
}

async function writeStore(store) {
  ensureEncryptionAvailable();
  const encrypted = safeStorage.encryptString(JSON.stringify(store));
  await fs.mkdir(paths.DATA_DIR, { recursive: true });
  await fs.writeFile(getStorePath(), encrypted);
}

// ==================== Phrase de récupération ====================

/**
 * Met en cache la phrase de récupération pour les sauvegardes automatiques.
 * @param {string} passphrase
 */
export async function setPassphrase(passphrase) {
  if (typeof passphrase !== "string" || passphrase.trim().length === 0) {
    throw new Error("Phrase de récupération invalide");
  }
  const store = await readStore();
  store.passphrase = passphrase;
  await writeStore(store);
  log.info("Backup passphrase cached");
}

/**
 * @returns {Promise<string|null>} la phrase de récupération en cache, ou null
 */
export async function getPassphrase() {
  const store = await readStore();
  return store.passphrase || null;
}

/**
 * @returns {Promise<boolean>} vrai si une phrase est en cache (sans l'exposer)
 */
export async function hasPassphrase() {
  try {
    const store = await readStore();
    return Boolean(store.passphrase);
  } catch {
    return false;
  }
}

// ==================== Session Supabase ====================

/**
 * Persiste la session d'authentification Supabase (refresh token + userId).
 * Le refresh token tourne à chaque renouvellement : on réécrit la valeur à jour.
 * @param {{ refreshToken: string, userId: string }} session
 */
export async function saveSupabaseSession(session) {
  const store = await readStore();
  store.supabase = {
    refreshToken: session.refreshToken,
    userId: session.userId,
  };
  await writeStore(store);
}

/**
 * @returns {Promise<{ refreshToken: string, userId: string }|null>}
 */
export async function getSupabaseSession() {
  const store = await readStore();
  return store.supabase || null;
}

/**
 * Supprime la session Supabase (déconnexion), en conservant la phrase.
 */
export async function clearSupabaseSession() {
  const store = await readStore();
  delete store.supabase;
  await writeStore(store);
  log.info("Supabase session cleared");
}
