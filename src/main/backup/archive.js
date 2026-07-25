import { promises as fs } from "fs";
import path from "path";
import { gzipSync, gunzipSync } from "zlib";

/**
 * Assemblage / extraction d'une archive logique du dossier `data/`.
 *
 * Choix de conception : plutôt qu'un vrai ZIP (dépendance externe), on
 * sérialise les fichiers retenus dans un seul objet JSON puis on le compresse
 * avec `zlib` (natif Node). Le volume réel (quelques Mo de JSON) rend ce format
 * parfaitement adapté et sans dépendance.
 *
 * Fichiers texte → stockés en UTF-8, fichiers binaires (logo) → base64.
 *
 * SÉCURITÉ : les secrets ne sont jamais inclus.
 *   - `credentials.enc` / `backup-secrets.enc` : chiffrés par `safeStorage`
 *     (liés à la machine), donc inutilisables ailleurs → exclus.
 *   - La phrase de récupération n'est jamais sur disque en clair.
 */

const ARCHIVE_VERSION = 1;

// Fichiers/dossiers à la racine de `data/` inclus dans la sauvegarde.
// Les dossiers sont parcourus récursivement.
const INCLUDE_ENTRIES = [
  { name: "config.json", type: "file", encoding: "utf8" },
  { name: "clients.json", type: "file", encoding: "utf8" },
  { name: "transactions.json", type: "file", encoding: "utf8" },
  { name: "logo.png", type: "file", encoding: "base64" },
  { name: "devis", type: "dir", encoding: "utf8" },
  { name: "factures", type: "dir", encoding: "utf8" },
];

// Jamais sauvegardés, même s'ils traînent dans un sous-dossier.
const EXCLUDED_BASENAMES = new Set(["credentials.enc", "backup-secrets.enc"]);

/**
 * Parcourt récursivement un dossier et renvoie les chemins relatifs des
 * fichiers (à `baseDir`), en ignorant les fichiers exclus.
 * @param {string} absDir
 * @param {string} baseDir
 * @returns {Promise<string[]>}
 */
async function walkDir(absDir, baseDir) {
  let entries;
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }

  const files = [];
  for (const entry of entries) {
    if (EXCLUDED_BASENAMES.has(entry.name)) continue;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(abs, baseDir)));
    } else if (entry.isFile()) {
      files.push(path.relative(baseDir, abs));
    }
  }
  return files;
}

/**
 * Construit une archive gzip du dossier `data/`.
 *
 * @param {string} dataDir - chemin absolu du dossier data
 * @returns {Promise<Buffer>} archive compressée (à chiffrer ensuite)
 */
export async function buildArchive(dataDir) {
  const files = [];

  for (const entry of INCLUDE_ENTRIES) {
    const abs = path.join(dataDir, entry.name);

    if (entry.type === "file") {
      let content;
      try {
        const buf = await fs.readFile(abs);
        content =
          entry.encoding === "base64"
            ? buf.toString("base64")
            : buf.toString("utf8");
      } catch (err) {
        if (err.code === "ENOENT") continue; // fichier optionnel absent
        throw err;
      }
      files.push({
        path: entry.name.split(path.sep).join("/"),
        encoding: entry.encoding,
        content,
      });
    } else {
      const relPaths = await walkDir(abs, dataDir);
      for (const rel of relPaths) {
        const buf = await fs.readFile(path.join(dataDir, rel));
        files.push({
          // Chemins normalisés en "/" pour être portables entre OS.
          path: rel.split(path.sep).join("/"),
          encoding: "utf8",
          content: buf.toString("utf8"),
        });
      }
    }
  }

  const manifest = {
    version: ARCHIVE_VERSION,
    createdAt: new Date().toISOString(),
    fileCount: files.length,
    files,
  };

  return gzipSync(Buffer.from(JSON.stringify(manifest), "utf8"));
}

/**
 * Décompresse et parse une archive produite par `buildArchive`.
 *
 * @param {Buffer} archive - archive gzip (déjà déchiffrée)
 * @returns {{ version: number, createdAt: string, files: Array }}
 */
export function extractArchive(archive) {
  const json = gunzipSync(archive).toString("utf8");
  const manifest = JSON.parse(json);
  if (!manifest || !Array.isArray(manifest.files)) {
    throw new Error("Archive de sauvegarde invalide");
  }
  return manifest;
}

/**
 * Réécrit les fichiers d'une archive extraite dans un dossier cible.
 * Utilisé lors de la restauration. Crée les sous-dossiers au besoin.
 *
 * @param {Array} files - `manifest.files`
 * @param {string} targetDir - dossier data cible
 */
export async function writeArchiveFiles(files, targetDir) {
  for (const file of files) {
    // Garde-fou anti-traversée de chemin : un chemin d'archive ne doit jamais
    // sortir de `targetDir`.
    const normalized = path.normalize(file.path).split("/").join(path.sep);
    const abs = path.join(targetDir, normalized);
    if (!abs.startsWith(path.resolve(targetDir) + path.sep)) {
      throw new Error(`Chemin d'archive invalide : ${file.path}`);
    }

    await fs.mkdir(path.dirname(abs), { recursive: true });
    const buf =
      file.encoding === "base64"
        ? Buffer.from(file.content, "base64")
        : Buffer.from(file.content, "utf8");
    await fs.writeFile(abs, buf);
  }
}
