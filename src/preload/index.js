import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  loadConfig: () => ipcRenderer.invoke("load-config"),
  saveConfig: (config) => ipcRenderer.invoke("save-config", config),
  uploadLogo: () => ipcRenderer.invoke("upload-logo"),
  deleteLogo: () => ipcRenderer.invoke("delete-logo"),
  getLogo: () => ipcRenderer.invoke("get-logo"),
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  loadDocuments: (type, filters) =>
    ipcRenderer.invoke("load-documents", type, filters),
  loadDocument: (type, id) => ipcRenderer.invoke("load-document", type, id),
  saveDocument: (type, document) =>
    ipcRenderer.invoke("save-document", type, document),
  deleteDocument: (type, id) => ipcRenderer.invoke("delete-document", type, id),
  loadClients: () => ipcRenderer.invoke("load-clients"),
  saveClient: (client) => ipcRenderer.invoke("save-client", client),
  deleteClient: (id) => ipcRenderer.invoke("delete-client", id),
  loadTransactions: () => ipcRenderer.invoke("load-transactions"),
  saveTransaction: (transaction) =>
    ipcRenderer.invoke("save-transaction", transaction),
  deleteTransaction: (id) => ipcRenderer.invoke("delete-transaction", id),
  validateDocument: (type, document) =>
    ipcRenderer.invoke("validate-document", type, document),
  generatePDF: (type, document) =>
    ipcRenderer.invoke("generate-pdf", type, document),
  onCheckingForUpdate: (callback) =>
    ipcRenderer.on("checking-for-update", () => callback()),
  onUpdateAvailable: (callback) =>
    ipcRenderer.on("update-available", (_, info) => callback(info)),
  onUpdateNotAvailable: (callback) =>
    ipcRenderer.on("update-not-available", () => callback()),
  onUpdateDownloaded: (callback) =>
    ipcRenderer.on("update-downloaded", (_, info) => callback(info)),
  onUpdateError: (callback) =>
    ipcRenderer.on("update-error", () => callback()),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  searchCompanies: (query) => ipcRenderer.invoke("company:search", query),

  pdp: {
    testConnection: (platform) =>
      ipcRenderer.invoke("pdp:test-connection", platform),
    saveCredentials: (providerName, credentials, platform) =>
      ipcRenderer.invoke(
        "pdp:save-credentials",
        providerName,
        credentials,
        platform,
      ),
    deleteCredentials: (providerName) =>
      ipcRenderer.invoke("pdp:delete-credentials", providerName),
    hasCredentials: (providerName) =>
      ipcRenderer.invoke("pdp:has-credentials", providerName),
    sendInvoice: (invoiceId, options) =>
      ipcRenderer.invoke("pdp:send-invoice", invoiceId, options),
    validateInvoice: (file, fileName) =>
      ipcRenderer.invoke("pdp:validate-invoice", file, fileName),
    fetchReceived: (opts) => ipcRenderer.invoke("pdp:fetch-received", opts),
    downloadReceivedPdf: (id, opts) =>
      ipcRenderer.invoke("pdp:download-received-pdf", id, opts),
    listEvents: (opts) => ipcRenderer.invoke("pdp:list-events", opts),
    createEvent: (payload) => ipcRenderer.invoke("pdp:create-event", payload),
    searchDirectory: (siren) =>
      ipcRenderer.invoke("pdp:search-directory", siren),
    resolveRecipient: (siren) =>
      ipcRenderer.invoke("pdp:resolve-recipient", siren),
    sync: () => ipcRenderer.invoke("pdp:sync"),
  },
});
