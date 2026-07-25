/**
 * Politique de déclenchement des sauvegardes automatiques.
 * Module pur (aucun import Electron / I/O) → testable en isolation.
 */

// Délai de regroupement après une écriture : plusieurs sauvegardes successives
// ne produisent qu'un seul envoi.
export const DEBOUNCE_MS = 20_000;

// Filet de sécurité au démarrage. Volontairement tardif : le poste de
// l'utilisatrice est lent à démarrer, on ne veut pas concurrencer le lancement.
export const STARTUP_DELAY_MS = 120_000;

// Au-delà de cette ancienneté, le filet de démarrage relance une sauvegarde.
export const STALE_MS = 24 * 60 * 60 * 1000;

/**
 * Décide si le filet de sécurité au démarrage doit relancer une sauvegarde.
 * Vrai si : jamais sauvegardé, dernière tentative en erreur, horodatage
 * illisible, ou dernière sauvegarde trop ancienne.
 *
 * @param {{ lastBackupAt?: string|null, lastError?: string|null }} backup
 * @param {number} now - timestamp courant (Date.now())
 * @returns {boolean}
 */
export function shouldRunStartupBackup(backup, now) {
  if (!backup) return true;
  if (backup.lastError) return true;
  if (!backup.lastBackupAt) return true;
  const last = new Date(backup.lastBackupAt).getTime();
  if (Number.isNaN(last)) return true;
  return now - last > STALE_MS;
}
