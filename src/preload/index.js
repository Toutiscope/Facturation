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
  validateDocument: (type, document) =>
    ipcRenderer.invoke("validate-document", type, document),
  generatePDF: (type, document) =>
    ipcRenderer.invoke("generate-pdf", type, document),
  exportFacturX: (invoice) => ipcRenderer.invoke("export-facturx", invoice),
  sendToChorus: (invoice) => ipcRenderer.invoke("send-chorus", invoice),
  fetchChorusInvoices: (filters) =>
    ipcRenderer.invoke("fetch-chorus-invoices", filters),
  downloadChorusPDF: (invoiceId) =>
    ipcRenderer.invoke("download-chorus-pdf", invoiceId),
  onUpdateAvailable: (callback) =>
    ipcRenderer.on("update-available", (_, info) => callback(info)),
  onUpdateDownloaded: (callback) =>
    ipcRenderer.on("update-downloaded", (_, info) => callback(info)),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
});
