import { ipcMain, shell, app, dialog } from "electron";
import {
  loadConfig,
  saveConfig,
  loadDocuments,
  loadDocument,
  saveDocument,
  deleteDocument,
  saveLogo,
  deleteLogo,
  getLogoAsBase64,
  loadClients,
  saveClient,
  deleteClient,
  loadTransactions,
  saveTransaction,
  deleteTransaction,
} from "./fileManager";
import { validateDocument, defaultEinvoice } from "./validator";
import { generatePDF } from "./pdfGenerator";
import { autoUpdater } from "electron-updater";
import log from "electron-log";
import {
  testConnection as pdpTestConnection,
  sendInvoice as pdpSendInvoice,
  validateInvoiceFile as pdpValidateInvoiceFile,
  fetchInvoices as pdpFetchInvoices,
  downloadInvoice as pdpDownloadInvoice,
  listEvents as pdpListEvents,
  createEvent as pdpCreateEvent,
  searchFrenchDirectory as pdpSearchFrenchDirectory,
  resetAdapterCache,
} from "./einvoiceApi/index.js";
import {
  saveProviderCredentials,
  deleteProviderCredentials,
  hasProviderCredentials,
} from "./einvoiceApi/secureCredentials.js";

/**
 * Initialise tous les handlers IPC
 */
export function initializeIPC() {
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

  // ==================== Logo ====================

  ipcMain.handle("upload-logo", async () => {
    try {
      const { filePaths, canceled } = await dialog.showOpenDialog({
        title: "Choisir un logo",
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
        properties: ["openFile"],
      });

      if (canceled || filePaths.length === 0) {
        return null;
      }

      await saveLogo(filePaths[0]);
      return await getLogoAsBase64();
    } catch (error) {
      log.error("Failed to upload logo:", error);
      throw error;
    }
  });

  ipcMain.handle("delete-logo", async () => {
    try {
      return await deleteLogo();
    } catch (error) {
      log.error("Failed to delete logo:", error);
      throw error;
    }
  });

  ipcMain.handle("get-logo", async () => {
    try {
      return await getLogoAsBase64();
    } catch (error) {
      log.error("Failed to get logo:", error);
      throw error;
    }
  });

  // ==================== Dossier ====================

  ipcMain.handle("select-folder", async () => {
    try {
      const { filePaths, canceled } = await dialog.showOpenDialog({
        title: "Choisir un dossier",
        properties: ["openDirectory"],
      });

      if (canceled || filePaths.length === 0) {
        return null;
      }

      return filePaths[0];
    } catch (error) {
      log.error("Failed to select folder:", error);
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

  // ==================== Clients ====================

  ipcMain.handle("load-clients", async () => {
    try {
      return await loadClients();
    } catch (error) {
      log.error("Failed to load clients:", error);
      throw error;
    }
  });

  ipcMain.handle("save-client", async (event, client) => {
    try {
      return await saveClient(client);
    } catch (error) {
      log.error("Failed to save client:", error);
      throw error;
    }
  });

  ipcMain.handle("delete-client", async (event, id) => {
    try {
      return await deleteClient(id);
    } catch (error) {
      log.error(`Failed to delete client ${id}:`, error);
      throw error;
    }
  });

  // ==================== Transactions ====================

  ipcMain.handle("load-transactions", async () => {
    try {
      return await loadTransactions();
    } catch (error) {
      log.error("Failed to load transactions:", error);
      throw error;
    }
  });

  ipcMain.handle("save-transaction", async (event, transaction) => {
    try {
      return await saveTransaction(transaction);
    } catch (error) {
      log.error("Failed to save transaction:", error);
      throw error;
    }
  });

  ipcMain.handle("delete-transaction", async (event, id) => {
    try {
      return await deleteTransaction(id);
    } catch (error) {
      log.error(`Failed to delete transaction ${id}:`, error);
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
    autoUpdater.quitAndInstall();
  });

  // ==================== PDP (Phase 4) ====================

  ipcMain.handle("pdp:test-connection", (event, platformOverride) =>
    wrapPdp(async () => {
      const config = await loadConfig();
      // Permet de tester la sélection courante de l'écran Paramètres avant
      // même que la configuration globale ait été sauvegardée sur disque.
      if (platformOverride && typeof platformOverride === "object") {
        config.einvoicePlatform = {
          ...config.einvoicePlatform,
          ...platformOverride,
        };
        resetAdapterCache();
      }
      return pdpTestConnection(config);
    }),
  );

  ipcMain.handle(
    "pdp:save-credentials",
    (event, providerName, credentials, platform) =>
      wrapPdp(async () => {
        assertProvider(providerName);
        assertCredentials(credentials);
        await saveProviderCredentials(providerName, credentials);

        // Persiste le choix de plateforme en même temps que les identifiants,
        // pour que l'envoi de factures fonctionne sans dépendre du bouton
        // « Sauvegarder la configuration » global.
        const config = await loadConfig();
        config.einvoicePlatform = {
          ...config.einvoicePlatform,
          ...(platform && typeof platform === "object" ? platform : {}),
          providerName,
        };
        await saveConfig(config);

        resetAdapterCache();
        return { saved: true, einvoicePlatform: config.einvoicePlatform };
      }),
  );

  ipcMain.handle("pdp:delete-credentials", (event, providerName) =>
    wrapPdp(async () => {
      assertProvider(providerName);
      await deleteProviderCredentials(providerName);
      resetAdapterCache();
      return { deleted: true };
    }),
  );

  ipcMain.handle("pdp:has-credentials", (event, providerName) =>
    wrapPdp(async () => {
      assertProvider(providerName);
      const has = await hasProviderCredentials(providerName);
      return { hasCredentials: has };
    }),
  );

  ipcMain.handle("pdp:send-invoice", (event, invoiceId, options = {}) =>
    wrapPdp(async () => {
      const config = await loadConfig();
      const invoice = await loadDocument("factures", invoiceId);

      const result = await pdpSendInvoice(config, invoice, options);

      const updated = {
        ...invoice,
        einvoice: {
          ...(invoice.einvoice || defaultEinvoice()),
          isSent: true,
          dateSending: new Date().toISOString(),
          depositNumber: String(result.depositId),
          providerName: config.einvoicePlatform.providerName,
          status: "submitted",
          errors: [],
        },
      };

      await saveDocument("factures", updated);
      return { invoice: updated, deposit: result.raw };
    }),
  );

  ipcMain.handle("pdp:validate-invoice", (event, file, fileName) =>
    wrapPdp(async () => {
      const config = await loadConfig();
      return pdpValidateInvoiceFile(config, file, fileName);
    }),
  );

  ipcMain.handle("pdp:fetch-received", (event, opts) =>
    wrapPdp(async () => {
      const config = await loadConfig();
      return pdpFetchInvoices(config, opts);
    }),
  );

  ipcMain.handle("pdp:download-received-pdf", (event, id) =>
    wrapPdp(async () => {
      const config = await loadConfig();
      const buffer = await pdpDownloadInvoice(config, id);
      return {
        base64: buffer.toString("base64"),
        size: buffer.length,
      };
    }),
  );

  ipcMain.handle("pdp:list-events", (event, opts) =>
    wrapPdp(async () => {
      const config = await loadConfig();
      return pdpListEvents(config, opts);
    }),
  );

  ipcMain.handle("pdp:create-event", (event, payload) =>
    wrapPdp(async () => {
      assertEventPayload(payload);
      const config = await loadConfig();
      return pdpCreateEvent(config, payload);
    }),
  );

  ipcMain.handle("pdp:search-directory", (event, siren) =>
    wrapPdp(async () => {
      if (!siren) throw new PdpInputError("SIREN requis");
      const config = await loadConfig();
      return pdpSearchFrenchDirectory(config, siren);
    }),
  );

  log.info("IPC handlers initialized");
}

// ============================================================
// Helpers PDP
// ============================================================

class PdpInputError extends Error {
  constructor(message) {
    super(message);
    this.code = "PDP_INPUT";
  }
}

function assertProvider(providerName) {
  if (!providerName || typeof providerName !== "string") {
    throw new PdpInputError("providerName requis");
  }
}

function assertCredentials(credentials) {
  if (
    !credentials ||
    typeof credentials !== "object" ||
    !credentials.client_id ||
    !credentials.client_secret
  ) {
    throw new PdpInputError("client_id et client_secret requis");
  }
}

function assertEventPayload(payload) {
  if (!payload || !payload.invoiceId || !payload.statusCode) {
    throw new PdpInputError("invoiceId et statusCode requis");
  }
}

/**
 * Wrappe une opération PDP pour normaliser les erreurs envoyées au renderer.
 * Le renderer reçoit toujours un objet { ok, data?, error? } via une promesse résolue
 * (et non un throw) — facilite la gestion UI.
 */
async function wrapPdp(operation) {
  try {
    const data = await operation();
    return { ok: true, data };
  } catch (err) {
    const code = err.code || "PDP_UNKNOWN";
    const status = err.status;
    const message = err.message || "Erreur inconnue";
    log.error(`PDP operation failed [${code}${status ? ` HTTP ${status}` : ""}]:`, message);
    return {
      ok: false,
      error: { code, status, message },
    };
  }
}

