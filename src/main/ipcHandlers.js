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
  fetchReceivedInvoices as pdpFetchReceivedInvoices,
  downloadInvoice as pdpDownloadInvoice,
  listEvents as pdpListEvents,
  createEvent as pdpCreateEvent,
  searchFrenchDirectory as pdpSearchFrenchDirectory,
  resolveRecipient as pdpResolveRecipient,
  resetAdapterCache,
} from "./einvoiceApi/index.js";
import { searchCompanies as searchCompanyDirectory } from "./companyDirectory.js";
import { promises as fsp } from "fs";
import {
  saveProviderCredentials,
  deleteProviderCredentials,
  hasProviderCredentials,
} from "./einvoiceApi/secureCredentials.js";
import { applyEventsToInvoice } from "./einvoiceApi/mappers/statusMapping.js";

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

  // ==================== Recherche d'entreprises (annuaire public) ====================

  ipcMain.handle("company:search", async (event, query) => {
    try {
      const data = await searchCompanyDirectory(query);
      return { ok: true, data };
    } catch (err) {
      log.error("Company search failed:", err.message);
      return {
        ok: false,
        error: {
          code: "COMPANY_SEARCH",
          message: "Recherche d'entreprise momentanément indisponible",
        },
      };
    }
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
      return pdpFetchReceivedInvoices(config, opts);
    }),
  );

  ipcMain.handle("pdp:download-received-pdf", (event, id, opts = {}) =>
    wrapPdp(async () => {
      const config = await loadConfig();
      // Par défaut, on télécharge la version Factur-X lisible (PDF). format=null → fichier original.
      const format = opts.format === undefined ? "factur-x" : opts.format;
      const { buffer, contentType, filename } = await pdpDownloadInvoice(
        config,
        id,
        format ? { format } : {},
      );

      const ext = contentType.includes("pdf")
        ? "pdf"
        : contentType.includes("xml")
          ? "xml"
          : "bin";
      const defaultName = filename || `facture-${id}.${ext}`;

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: "Enregistrer la facture reçue",
        defaultPath: defaultName,
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
      });
      if (canceled || !filePath) return { canceled: true };

      await fsp.writeFile(filePath, buffer);
      return { saved: true, path: filePath };
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

  ipcMain.handle("pdp:resolve-recipient", (event, siren) =>
    wrapPdp(async () => {
      if (!siren) throw new PdpInputError("SIREN requis");
      const config = await loadConfig();
      return pdpResolveRecipient(config, siren);
    }),
  );

  ipcMain.handle("pdp:sync", () => wrapPdp(() => runEinvoiceSync()));

  log.info("IPC handlers initialized");
}

/**
 * Synchronise les statuts de cycle de vie des factures envoyées :
 * récupère les événements PDP depuis le dernier id traité, les applique
 * aux factures locales (matchées par depositNumber), et persiste l'avancement.
 *
 * Périmètre : factures de l'année courante (les événements de cycle de vie
 * surviennent dans les mois suivant l'envoi). saveDocument écrit dans le
 * dossier de l'année courante.
 *
 * @returns {Promise<{ processedEvents: number, updatedInvoices: number }>}
 */
async function runEinvoiceSync() {
  const config = await loadConfig();
  const platform = config.einvoicePlatform || {};

  // 1. Récupère les événements depuis le dernier id connu (paginé)
  let cursor = platform.lastSyncedEventId || null;
  const allEvents = [];
  for (let page = 0; page < 50; page++) {
    const res = await pdpListEvents(config, {
      startingAfterId: cursor,
      limit: 100,
    });
    const batch = (res && res.data) || [];
    if (batch.length === 0) break;
    allEvents.push(...batch);
    cursor = batch[batch.length - 1].id;
    if (res.has_after === false || batch.length < 100) break;
  }

  if (allEvents.length === 0) {
    return { processedEvents: 0, updatedInvoices: 0 };
  }

  // 2. Indexe les factures locales (année courante) par depositNumber
  const currentYear = new Date().getFullYear();
  const invoices = await loadDocuments("factures", { year: currentYear });
  const byDeposit = new Map();
  for (const inv of invoices) {
    const dep = inv.einvoice && inv.einvoice.depositNumber;
    if (dep) byDeposit.set(String(dep), inv);
  }

  // 3. Groupe les événements par facture et applique aux factures connues
  const grouped = new Map();
  for (const e of allEvents) {
    const key = String(e.invoice_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(e);
  }

  let updated = 0;
  for (const [invoiceId, events] of grouped) {
    const local = byDeposit.get(invoiceId);
    if (!local) continue;
    const next = applyEventsToInvoice(local, events);
    await saveDocument("factures", next);
    updated += 1;
  }

  // 4. Persiste le dernier id d'événement traité
  const maxId = allEvents.reduce(
    (m, e) => Math.max(m, e.id || 0),
    platform.lastSyncedEventId || 0,
  );
  config.einvoicePlatform = { ...platform, lastSyncedEventId: maxId };
  await saveConfig(config);

  return { processedEvents: allEvents.length, updatedInvoices: updated };
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
    const details = extractErrorDetails(err.body);
    log.error(
      `PDP operation failed [${code}${status ? ` HTTP ${status}` : ""}]:`,
      message,
      err.body ? `\nDétail PDP : ${err.body}` : "",
    );
    return {
      ok: false,
      error: { code, status, message, details },
    };
  }
}

/**
 * Extrait un message lisible du corps de réponse d'erreur d'une PDP.
 * Les PDP renvoient généralement un JSON ({ message } / { error } / { errors: [...] }),
 * parfois du texte brut. On retombe sur le texte tronqué si rien d'exploitable.
 * @param {string|null|undefined} body
 * @returns {string|null}
 */
function extractErrorDetails(body) {
  if (!body || typeof body !== "string") return null;
  try {
    const json = JSON.parse(body);
    if (typeof json === "string") return json;
    if (json.message) return json.message;
    if (json.error) {
      return typeof json.error === "string"
        ? json.error
        : json.error.message || JSON.stringify(json.error);
    }
    if (Array.isArray(json.errors) && json.errors.length) {
      return json.errors
        .map((e) => (typeof e === "string" ? e : e.message || JSON.stringify(e)))
        .join(" • ");
    }
    return JSON.stringify(json);
  } catch {
    return body.slice(0, 500);
  }
}

