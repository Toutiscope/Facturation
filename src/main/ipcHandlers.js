const { ipcMain, shell, app } = require("electron");
const {
  loadConfig,
  saveConfig,
  loadDocuments,
  loadDocument,
  saveDocument,
  deleteDocument,
} = require("./fileManager");
const { validateDocument } = require("./validator");
const { generatePDF } = require("./pdfGenerator");
const log = require("electron-log");

/**
 * Initialise tous les handlers IPC
 */
function initializeIPC() {
  // ==================== Configuration ====================

  ipcMain.handle("load-config", async () => {
    try {
      return await loadConfig();
    } catch (error) {
      log.error("Failed to load config:", error);
      throw error;
    }
  });

  ipcMain.handle("save-config", async (event, config) => {
    try {
      return await saveConfig(config);
    } catch (error) {
      log.error("Failed to save config:", error);
      throw error;
    }
  });

  // ==================== Documents ====================

  ipcMain.handle("load-documents", async (event, type, filters) => {
    try {
      return await loadDocuments(type, filters);
    } catch (error) {
      log.error(`Failed to load ${type}:`, error);
      throw error;
    }
  });

  ipcMain.handle("load-document", async (event, type, id) => {
    try {
      return await loadDocument(type, id);
    } catch (error) {
      log.error(`Failed to load ${type} ${id}:`, error);
      throw error;
    }
  });

  ipcMain.handle("save-document", async (event, type, document) => {
    try {
      return await saveDocument(type, document);
    } catch (error) {
      log.error(`Failed to save ${type}:`, error);
      throw error;
    }
  });

  ipcMain.handle("delete-document", async (event, type, id) => {
    try {
      return await deleteDocument(type, id);
    } catch (error) {
      log.error(`Failed to delete ${type} ${id}:`, error);
      throw error;
    }
  });

  // ==================== Validation (Phase 2) ====================

  ipcMain.handle("validate-document", async (event, type, document) => {
    try {
      return validateDocument(type, document);
    } catch (error) {
      log.error(`Failed to validate ${type}:`, error);
      throw error;
    }
  });

  // ==================== PDF (Phase 3) ====================

  ipcMain.handle("generate-pdf", async (event, type, document) => {
    try {
      return await generatePDF(type, document);
    } catch (error) {
      log.error("Failed to generate PDF:", error);
      throw error;
    }
  });

  ipcMain.handle("export-facturx", async (event, invoice) => {
    // TODO: Phase 3/4 - Implémenter export Factur-X
    log.info("export-facturx called (stub)");
    return null;
  });

  // ==================== Chorus Pro (Phase 4) ====================

  ipcMain.handle("send-chorus", async (event, invoice) => {
    // TODO: Phase 4 - Implémenter envoi Chorus Pro
    log.info("send-chorus called (stub)");
    return null;
  });

  ipcMain.handle("fetch-chorus-invoices", async (event, filters) => {
    // TODO: Phase 4 - Implémenter récupération factures Chorus Pro
    log.info("fetch-chorus-invoices called (stub)");
    return [];
  });

  ipcMain.handle("download-chorus-pdf", async (event, invoiceId) => {
    // TODO: Phase 4 - Implémenter download PDF Chorus Pro
    log.info("download-chorus-pdf called (stub)");
    return null;
  });

  // ==================== Système ====================

  ipcMain.handle("get-app-version", () => {
    return app.getVersion();
  });

  ipcMain.handle("open-external", async (event, url) => {
    await shell.openExternal(url);
  });

  // ==================== Auto-update (Phase 5) ====================

  ipcMain.handle("install-update", () => {
    log.info("Installing update and restarting...");
    const { autoUpdater } = require("electron-updater");
    autoUpdater.quitAndInstall();
  });

  log.info("IPC handlers initialized");
}

module.exports = { initializeIPC };
