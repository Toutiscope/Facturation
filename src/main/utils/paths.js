import { app } from "electron";
import path from "path";
import { promises as fs } from "fs";
import log from "electron-log";

const DEFAULT_CONFIG = {
  company: {
    companyName: "",
    ownerName: "",
    companyId: "",
    registeredAddress: "",
    address: "",
    postalCode: "",
    city: "",
    email: "",
    phoneNumber: "",
    webSite: "",
  },
  rib: {
    iban: "",
    bic: "",
    holder: "",
  },
  billing: {
    legalNotice: "",
    paymentTerms: "Paiement à 30 jours",
    meansOfPayment: "Virement bancaire, chèque",
    latePenalties:
      "En cas de retard de paiement, application de pénalités de retard au taux de 10% par an et d'une indemnité forfaitaire pour frais de recouvrement de 40€.",
    latestQuoteNumber: 0,
    latestInvoiceNumber: 0,
    pdfOutputPath: "",
    // Montants URSSAF saisis manuellement, indexés par mois "YYYY-MM".
    // Un mois présent ici fige sa valeur (le calcul automatique ne s'applique
    // plus pour ce mois).
    urssafOverrides: {},
  },
  einvoicePlatform: {
    providerName: "",
    urlApi: "",
    isSandbox: false,
    lastSyncedEventId: null,
  },
};

export const DEFAULT_EINVOICE_PLATFORM = DEFAULT_CONFIG.einvoicePlatform;
export { DEFAULT_CONFIG };

// Fonctions lazy pour obtenir les chemins (évite l'accès à app avant qu'il soit ready)
const getPaths = () => {
  const DATA_DIR = path.join(app.getPath("userData"), "data");
  return {
    DATA_DIR,
    CONFIG_PATH: path.join(DATA_DIR, "config.json"),
    DEVIS_DIR: path.join(DATA_DIR, "devis"),
    FACTURES_DIR: path.join(DATA_DIR, "factures"),
    CLIENTS_PATH: path.join(DATA_DIR, "clients.json"),
    TRANSACTIONS_PATH: path.join(DATA_DIR, "transactions.json"),
  };
};

/**
 * Initialise le dossier data au premier lancement
 * Crée les dossiers nécessaires et génère la configuration par défaut
 */
export async function initializeDataFolder() {
  try {
    const { DATA_DIR, CONFIG_PATH, DEVIS_DIR, FACTURES_DIR } = getPaths();

    // Créer dossiers data/, devis/, factures/ si n'existent pas
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(DEVIS_DIR, { recursive: true });
    await fs.mkdir(FACTURES_DIR, { recursive: true });

    // Si config.json n'existe pas, créer depuis la config par défaut
    try {
      await fs.access(CONFIG_PATH);
      log.info("config.json already exists");
    } catch {
      log.info("First launch detected, creating config.json");
      await fs.writeFile(
        CONFIG_PATH,
        JSON.stringify(DEFAULT_CONFIG, null, 2),
        "utf-8",
      );
      log.info("config.json created successfully");
    }

    // Si clients.json n'existe pas, créer un tableau vide
    const { CLIENTS_PATH, TRANSACTIONS_PATH } = getPaths();
    try {
      await fs.access(CLIENTS_PATH);
    } catch {
      await fs.writeFile(CLIENTS_PATH, "[]", "utf-8");
      log.info("clients.json created successfully");
    }

    // Si transactions.json n'existe pas, créer un tableau vide
    try {
      await fs.access(TRANSACTIONS_PATH);
    } catch {
      await fs.writeFile(TRANSACTIONS_PATH, "[]", "utf-8");
      log.info("transactions.json created successfully");
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
  get LOGO_PATH() {
    return path.join(getPaths().DATA_DIR, "logo.png");
  },
  get CLIENTS_PATH() {
    return getPaths().CLIENTS_PATH;
  },
  get TRANSACTIONS_PATH() {
    return getPaths().TRANSACTIONS_PATH;
  },
  get EINVOICE_CREDENTIALS_PATH() {
    return path.join(getPaths().DATA_DIR, "credentials.enc");
  },
};

export default paths;
