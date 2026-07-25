import log from "electron-log";
import { loadConfig, saveConfig } from "../fileManager.js";
import { runBackup } from "./index.js";
import { hasPassphrase, getSupabaseSession } from "./secureBackupStore.js";
import { DEBOUNCE_MS, STALE_MS, shouldRunStartupBackup } from "./policy.js";

/**
 * Ordonnanceur des sauvegardes automatiques.
 *
 * - `scheduleBackup()` : appelé après chaque écriture (devis, facture, client,
 *   transaction, config). Débounce 20 s → un seul envoi pour une rafale.
 * - `runStartupCheck()` : filet de sécurité, déclenché ~2 min après l'ouverture
 *   (cf. index.js), qui relance une sauvegarde si la dernière est trop ancienne
 *   ou a échoué.
 *
 * Une sauvegarde qui échoue n'est jamais bloquante : le JSON local reste la
 * source de vérité, l'erreur est journalisée et la prochaine écriture (ou le
 * démarrage suivant) réessaiera.
 */

let debounceTimer = null;
let running = false;
let rerunQueued = false;

/**
 * La sauvegarde est-elle prête à tourner (activée, connectée, phrase définie) ?
 * @returns {Promise<{ ready: boolean, config?: Object }>}
 */
async function getReadiness() {
  const config = await loadConfig();
  const b = config.backup || {};
  if (!b.enabled) return { ready: false };
  if (!(await hasPassphrase())) return { ready: false };
  const session = await getSupabaseSession();
  if (!session || !session.refreshToken) return { ready: false };
  return { ready: true, config };
}

/**
 * Exécute une sauvegarde et enregistre l'issue (horodatage ou message d'erreur)
 * dans config.backup. Utilisé par le déclenchement manuel, le débounce et le
 * filet de démarrage.
 * @returns {Promise<Object>} résultat de runBackup
 */
export async function performBackup() {
  const config = await loadConfig();
  try {
    const result = await runBackup(config);
    const fresh = await loadConfig();
    fresh.backup = {
      ...(fresh.backup || {}),
      lastBackupAt: result.createdAt,
      lastError: null,
    };
    await saveConfig(fresh);
    return result;
  } catch (err) {
    const fresh = await loadConfig();
    fresh.backup = { ...(fresh.backup || {}), lastError: err.message };
    await saveConfig(fresh);
    throw err;
  }
}

/**
 * Lance une sauvegarde en respectant la garde de réentrance : si une
 * sauvegarde tourne déjà, on en re-planifie une à la fin (les données ont pu
 * changer entre-temps).
 */
async function runGuarded() {
  if (running) {
    rerunQueued = true;
    return;
  }
  running = true;
  try {
    const { ready } = await getReadiness();
    if (!ready) return;
    await performBackup();
    log.info("Scheduled backup completed");
  } catch (err) {
    log.warn(
      "Scheduled backup failed (will retry on next trigger):",
      err.message,
    );
  } finally {
    running = false;
    if (rerunQueued) {
      rerunQueued = false;
      scheduleBackup();
    }
  }
}

/**
 * (Ré)arme le débounce après une écriture. Sans effet si la sauvegarde n'est
 * pas configurée (la garde est vérifiée au moment de l'exécution).
 */
export function scheduleBackup() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    runGuarded();
  }, DEBOUNCE_MS);
}

/**
 * Filet de sécurité au démarrage : relance une sauvegarde si la dernière est
 * trop ancienne (> 24 h) ou si la précédente avait échoué.
 */
export async function runStartupCheck() {
  try {
    const { ready, config } = await getReadiness();
    if (!ready) return;
    if (shouldRunStartupBackup(config.backup, Date.now())) {
      log.info("Startup backup check: running (stale or previous error)");
      await performBackup();
    } else {
      log.info("Startup backup check: recent backup present, skipping");
    }
  } catch (err) {
    log.warn("Startup backup check failed:", err.message);
  }
}

export { STALE_MS };
