import { safeStorage } from "electron";
import { promises as fs } from "fs";
import path from "path";
import paths from "../utils/paths.js";
import log from "electron-log";

const FILE_NAME = "credentials.enc";

function getCredentialsPath() {
  return path.join(paths.DATA_DIR, FILE_NAME);
}

function ensureEncryptionAvailable() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "Le chiffrement sécurisé n'est pas disponible sur ce poste (safeStorage). " +
        "Impossible de stocker les identifiants PDP de manière sûre.",
    );
  }
}

/**
 * Lit et déchiffre les credentials PDP stockés sur disque.
 * @returns {Promise<Object|null>} objet { providerName: { client_id, client_secret, ... } } ou null si fichier absent
 */
export async function readCredentials() {
  ensureEncryptionAvailable();
  try {
    const buffer = await fs.readFile(getCredentialsPath());
    const decrypted = safeStorage.decryptString(buffer);
    return JSON.parse(decrypted);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    log.error("Failed to read PDP credentials:", err);
    throw new Error("Impossible de lire les identifiants PDP chiffrés");
  }
}

/**
 * Récupère les credentials d'un provider précis.
 * @param {string} providerName
 * @returns {Promise<Object|null>}
 */
export async function getProviderCredentials(providerName) {
  const all = await readCredentials();
  if (!all || !all[providerName]) return null;
  return all[providerName];
}

/**
 * Persiste les credentials d'un provider (chiffrés). Fusionne avec les credentials existants.
 * @param {string} providerName
 * @param {Object} credentials - { client_id, client_secret, ... }
 */
export async function saveProviderCredentials(providerName, credentials) {
  ensureEncryptionAvailable();

  const current = (await readCredentials()) || {};
  current[providerName] = credentials;

  const encrypted = safeStorage.encryptString(JSON.stringify(current));
  await fs.mkdir(paths.DATA_DIR, { recursive: true });
  await fs.writeFile(getCredentialsPath(), encrypted);

  log.info(`PDP credentials saved for provider: ${providerName}`);
}

/**
 * Supprime les credentials d'un provider donné.
 * @param {string} providerName
 */
export async function deleteProviderCredentials(providerName) {
  const current = await readCredentials();
  if (!current || !current[providerName]) return;

  delete current[providerName];

  if (Object.keys(current).length === 0) {
    try {
      await fs.unlink(getCredentialsPath());
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  } else {
    ensureEncryptionAvailable();
    const encrypted = safeStorage.encryptString(JSON.stringify(current));
    await fs.writeFile(getCredentialsPath(), encrypted);
  }

  log.info(`PDP credentials deleted for provider: ${providerName}`);
}

/**
 * Indique si des credentials existent pour un provider donné (sans renvoyer les valeurs).
 * @param {string} providerName
 * @returns {Promise<boolean>}
 */
export async function hasProviderCredentials(providerName) {
  try {
    const creds = await getProviderCredentials(providerName);
    return Boolean(creds && creds.client_id && creds.client_secret);
  } catch {
    return false;
  }
}
