import { promises as fs } from "fs";
import path from "path";
import paths, { getYearFolder } from "./utils/paths";
import log from "electron-log";

// Cache de la configuration en mémoire pour performance
let configCache = null;

/**
 * Charge la configuration depuis config.json
 * @returns {Promise<Object>} Configuration
 */
export async function loadConfig() {
  try {
    // Utiliser le cache si disponible
    if (configCache) {
      return configCache;
    }

    const data = await fs.readFile(paths.CONFIG_PATH, "utf-8");
    configCache = JSON.parse(data);
    return configCache;
  } catch (error) {
    log.error("Failed to load config:", error);
    throw new Error("Impossible de charger la configuration");
  }
}

/**
 * Sauvegarde la configuration dans config.json
 * @param {Object} config - Configuration à sauvegarder
 * @returns {Promise<boolean>}
 */
export async function saveConfig(config) {
  try {
    await fs.writeFile(
      paths.CONFIG_PATH,
      JSON.stringify(config, null, 2),
      "utf-8",
    );
    configCache = config; // Mettre à jour le cache
    log.info("Config saved successfully");
    return true;
  } catch (error) {
    log.error("Failed to save config:", error);
    throw new Error("Impossible de sauvegarder la configuration");
  }
}

/**
 * Vide le cache de configuration (utile pour forcer un reload)
 */
function clearConfigCache() {
  configCache = null;
}

/**
 * Charge tous les documents d'un type donné
 * @param {string} type - 'devis' ou 'factures'
 * @param {Object} filters - Filtres { year, status, search }
 * @returns {Promise<Array>} Liste des documents
 */
export async function loadDocuments(type, filters = {}) {
  try {
    const { year, status, search } = filters;
    const targetYear = year || new Date().getFullYear();
    const yearFolder = getYearFolder(type, targetYear);

    // Créer le dossier de l'année si n'existe pas
    await fs.mkdir(yearFolder, { recursive: true });

    // Lire tous les fichiers JSON
    const files = await fs.readdir(yearFolder);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const documents = await Promise.all(
      jsonFiles.map(async (file) => {
        const filePath = path.join(yearFolder, file);
        const content = await fs.readFile(filePath, "utf-8");
        return JSON.parse(content);
      }),
    );

    // Filtrer selon status et search
    let filtered = documents;

    if (status) {
      filtered = filtered.filter((doc) => doc.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.numero.toLowerCase().includes(searchLower) ||
          doc.customer.customerName.toLowerCase().includes(searchLower) ||
          doc.customer.companyName.toLowerCase().includes(searchLower),
      );
    }

    // Trier par date décroissante
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return filtered;
  } catch (error) {
    log.error(`Failed to load ${type}:`, error);
    throw new Error(`Impossible de charger les ${type}`);
  }
}

/**
 * Charge un document spécifique
 * @param {string} type - 'devis' ou 'factures'
 * @param {string} id - ID du document
 * @returns {Promise<Object>} Document
 */
export async function loadDocument(type, id) {
  try {
    // Extraire l'année du numéro (ex: D000001 -> année courante)
    // Pour simplifier Phase 1, on utilise l'année courante
    const year = new Date().getFullYear();
    const yearFolder = getYearFolder(type, year);
    const filePath = path.join(yearFolder, `${id}.json`);

    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("Document introuvable");
    }
    log.error(`Failed to load ${type} ${id}:`, error);
    throw new Error("Erreur lors du chargement du document");
  }
}

/**
 * Sauvegarde un document
 * @param {string} type - 'devis' ou 'factures'
 * @param {Object} document - Document à sauvegarder
 * @returns {Promise<Object>} Document sauvegardé
 */
export async function saveDocument(type, document) {
  try {
    // Générer ID si nouveau document
    if (!document.id) {
      document.id = document.numero;
    }

    // Dates
    const now = new Date().toISOString();
    if (!document.createdAt) {
      document.createdAt = now;
    }
    document.editedAt = now;

    // Pour Phase 1, utiliser l'année courante
    const year = new Date().getFullYear();
    const yearFolder = getYearFolder(type, year);
    await fs.mkdir(yearFolder, { recursive: true });

    const filePath = path.join(yearFolder, `${document.id}.json`);

    await fs.writeFile(filePath, JSON.stringify(document, null, 2), "utf-8");

    log.info(`${type} ${document.id} saved successfully`);
    return document;
  } catch (error) {
    log.error(`Failed to save ${type}:`, error);
    throw new Error("Erreur lors de la sauvegarde du document");
  }
}

/**
 * Supprime un document
 * @param {string} type - 'devis' ou 'factures'
 * @param {string} id - ID du document
 * @returns {Promise<boolean>}
 */
export async function deleteDocument(type, id) {
  try {
    // Pour Phase 1, utiliser l'année courante
    const year = new Date().getFullYear();
    const yearFolder = getYearFolder(type, year);
    const filePath = path.join(yearFolder, `${id}.json`);

    await fs.unlink(filePath);

    log.info(`${type} ${id} deleted successfully`);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("Document introuvable");
    }
    log.error(`Failed to delete ${type} ${id}:`, error);
    throw new Error("Erreur lors de la suppression du document");
  }
}
