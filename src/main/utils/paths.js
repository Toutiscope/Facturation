import { app } from "electron";
import path from "path";
import { promises as fs } from "fs";
import log from "electron-log";

// Fonctions lazy pour obtenir les chemins (évite l'accès à app avant qu'il soit ready)
const getPaths = () => {
  const DATA_DIR = path.join(app.getPath("userData"), "data");
  return {
    DATA_DIR,
    CONFIG_PATH: path.join(DATA_DIR, "config.json"),
    DEVIS_DIR: path.join(DATA_DIR, "devis"),
    FACTURES_DIR: path.join(DATA_DIR, "factures"),
    CONFIG_TEMPLATE_PATH: path.join(process.cwd(), "config.template.json"),
  };
};

/**
 * Initialise le dossier data au premier lancement
 * Crée les dossiers nécessaires et copie le template de configuration
 */
export async function initializeDataFolder() {
  try {
    const {
      DATA_DIR,
      CONFIG_PATH,
      DEVIS_DIR,
      FACTURES_DIR,
      CONFIG_TEMPLATE_PATH,
    } = getPaths();

    // Créer dossiers data/, devis/, factures/ si n'existent pas
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(DEVIS_DIR, { recursive: true });
    await fs.mkdir(FACTURES_DIR, { recursive: true });

    // Si config.json n'existe pas, copier le template
    try {
      await fs.access(CONFIG_PATH);
      log.info("config.json already exists");
    } catch {
      log.info("First launch detected, creating config.json from template");
      const template = await fs.readFile(CONFIG_TEMPLATE_PATH, "utf-8");
      await fs.writeFile(CONFIG_PATH, template, "utf-8");
      log.info("config.json created successfully");
    }

    return true;
  } catch (error) {
    log.error("Failed to initialize data folder:", error);
    throw error;
  }
}

/**
 * Retourne le chemin du dossier pour une année donnée
 * @param {string} type - 'devis' ou 'factures'
 * @param {number} year - Année
 * @returns {string} Chemin du dossier
 */
export function getYearFolder(type, year) {
  const { DEVIS_DIR, FACTURES_DIR } = getPaths();
  const baseDir = type === "devis" ? DEVIS_DIR : FACTURES_DIR;
  return path.join(baseDir, String(year));
}

// Export avec getters
// ES6 version avec getters "live"
const paths = {
  get DATA_DIR() {
    return getPaths().DATA_DIR;
  },
  get CONFIG_PATH() {
    return getPaths().CONFIG_PATH;
  },
  get DEVIS_DIR() {
    return getPaths().DEVIS_DIR;
  },
  get FACTURES_DIR() {
    return getPaths().FACTURES_DIR;
  },
};

export default paths;
