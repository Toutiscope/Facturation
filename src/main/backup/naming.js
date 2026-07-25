/**
 * Helpers purs de nommage / rétention des archives.
 * Aucun import Electron ni I/O : testables en isolation.
 */

export const BACKUP_EXTENSION = ".fbak";
export const DEFAULT_RETENTION = 15;

/**
 * Nom d'objet horodaté et triable lexicographiquement.
 * @param {Date} date
 * @returns {string} ex: "backup-2026-07-25T18-30-05-123Z.fbak"
 */
export function makeBackupName(date) {
  const iso = date.toISOString().replace(/[:.]/g, "-");
  return `backup-${iso}${BACKUP_EXTENSION}`;
}

/**
 * Détermine les sauvegardes à supprimer pour ne conserver que les `keep` plus
 * récentes. Les noms étant horodatés ISO, un tri lexicographique décroissant
 * suffit (pas de dépendance à `updated_at`).
 *
 * @param {Array<{name:string}>} objects
 * @param {number} keep - nombre d'archives à conserver
 * @returns {string[]} noms à supprimer
 */
export function selectStaleBackups(objects, keep = DEFAULT_RETENTION) {
  const backups = (objects || [])
    .filter((o) => o && o.name && o.name.endsWith(BACKUP_EXTENSION))
    .map((o) => o.name)
    .sort()
    .reverse();
  return backups.slice(keep);
}
