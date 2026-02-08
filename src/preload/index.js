const { contextBridge, ipcRenderer } = require('electron')

/**
 * Exposition sécurisée des APIs Electron au renderer via contextBridge
 * Toutes les communications IPC passent par ce pont sécurisé
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ==================== Configuration ====================

  /**
   * Charge la configuration utilisateur
   * @returns {Promise<Object>} Configuration
   */
  loadConfig: () => ipcRenderer.invoke('load-config'),

  /**
   * Sauvegarde la configuration utilisateur
   * @param {Object} config - Configuration à sauvegarder
   * @returns {Promise<boolean>}
   */
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // ==================== Documents ====================

  /**
   * Charge tous les documents d'un type
   * @param {string} type - 'devis' ou 'factures'
   * @param {Object} filters - Filtres { year, status, search }
   * @returns {Promise<Array>} Liste des documents
   */
  loadDocuments: (type, filters) => ipcRenderer.invoke('load-documents', type, filters),

  /**
   * Charge un document spécifique
   * @param {string} type - 'devis' ou 'factures'
   * @param {string} id - ID du document
   * @returns {Promise<Object>} Document
   */
  loadDocument: (type, id) => ipcRenderer.invoke('load-document', type, id),

  /**
   * Sauvegarde un document
   * @param {string} type - 'devis' ou 'factures'
   * @param {Object} document - Document à sauvegarder
   * @returns {Promise<Object>} Document sauvegardé
   */
  saveDocument: (type, document) => ipcRenderer.invoke('save-document', type, document),

  /**
   * Supprime un document
   * @param {string} type - 'devis' ou 'factures'
   * @param {string} id - ID du document
   * @returns {Promise<boolean>}
   */
  deleteDocument: (type, id) => ipcRenderer.invoke('delete-document', type, id),

  // ==================== Validation ====================

  /**
   * Valide un document avant sauvegarde/export
   * @param {string} type - 'devis' ou 'factures'
   * @param {Object} document - Document à valider
   * @returns {Promise<{valid: boolean, errors: Array}>}
   */
  validateDocument: (type, document) => ipcRenderer.invoke('validate-document', type, document),

  // ==================== PDF ====================

  /**
   * Génère un PDF pour un document
   * @param {string} type - 'devis' ou 'factures'
   * @param {Object} document - Document à exporter
   * @returns {Promise<string>} Chemin du fichier PDF généré
   */
  generatePDF: (type, document) => ipcRenderer.invoke('generate-pdf', type, document),

  /**
   * Exporte une facture au format Factur-X
   * @param {Object} invoice - Facture à exporter
   * @returns {Promise<string>} Chemin du fichier Factur-X
   */
  exportFacturX: (invoice) => ipcRenderer.invoke('export-facturx', invoice),

  // ==================== Chorus Pro ====================

  /**
   * Envoie une facture à Chorus Pro
   * @param {Object} invoice - Facture à envoyer
   * @returns {Promise<Object>} Résultat de l'envoi
   */
  sendToChorus: (invoice) => ipcRenderer.invoke('send-chorus', invoice),

  /**
   * Récupère les factures reçues depuis Chorus Pro
   * @param {Object} filters - Filtres { dateFrom, dateTo, status }
   * @returns {Promise<Array>} Liste des factures reçues
   */
  fetchChorusInvoices: (filters) => ipcRenderer.invoke('fetch-chorus-invoices', filters),

  /**
   * Télécharge le PDF d'une facture reçue depuis Chorus Pro
   * @param {string} invoiceId - ID de la facture
   * @returns {Promise<string>} Chemin du fichier PDF
   */
  downloadChorusPDF: (invoiceId) => ipcRenderer.invoke('download-chorus-pdf', invoiceId),

  // ==================== Auto-update ====================

  /**
   * Écoute les notifications de mise à jour disponible
   * @param {Function} callback - Fonction appelée quand une mise à jour est disponible
   */
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_, info) => callback(info)),

  /**
   * Écoute les notifications de mise à jour téléchargée
   * @param {Function} callback - Fonction appelée quand une mise à jour est téléchargée
   */
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_, info) => callback(info)),

  /**
   * Installe et redémarre l'application avec la nouvelle version
   */
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // ==================== Système ====================

  /**
   * Récupère la version de l'application
   * @returns {Promise<string>} Version
   */
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  /**
   * Ouvre une URL dans le navigateur par défaut
   * @param {string} url - URL à ouvrir
   */
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
})
