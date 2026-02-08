import { ref, computed } from 'vue'

/**
 * Composable pour gérer les documents (devis ou factures)
 * @param {string} type - 'devis' ou 'factures'
 * @returns {Object} Méthodes et états pour gérer les documents
 */
export function useDocuments(type) {
  const documents = ref([])
  const loading = ref(false)
  const error = ref(null)

  /**
   * Charge tous les documents avec filtres optionnels
   * @param {Object} filters - { year, status, search }
   */
  async function loadAll(filters = {}) {
    loading.value = true
    error.value = null

    try {
      const result = await window.electronAPI.loadDocuments(type, filters)
      documents.value = result
      return result
    } catch (err) {
      error.value = err.message || `Erreur lors du chargement des ${type}`
      console.error(`Failed to load ${type}:`, err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Charge un document spécifique
   * @param {string} id - ID du document
   */
  async function loadOne(id) {
    loading.value = true
    error.value = null

    try {
      const result = await window.electronAPI.loadDocument(type, id)
      return result
    } catch (err) {
      error.value = err.message || `Erreur lors du chargement du document`
      console.error(`Failed to load ${type} ${id}:`, err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Sauvegarde un document
   * @param {Object} document - Document à sauvegarder
   */
  async function save(document) {
    loading.value = true
    error.value = null

    try {
      const result = await window.electronAPI.saveDocument(type, document)

      // Recharger la liste pour avoir les données à jour
      await loadAll()

      return result
    } catch (err) {
      error.value = err.message || `Erreur lors de la sauvegarde du document`
      console.error(`Failed to save ${type}:`, err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Supprime un document
   * @param {string} id - ID du document à supprimer
   */
  async function remove(id) {
    loading.value = true
    error.value = null

    try {
      await window.electronAPI.deleteDocument(type, id)

      // Retirer de la liste locale
      documents.value = documents.value.filter(doc => doc.id !== id)

      return true
    } catch (err) {
      error.value = err.message || `Erreur lors de la suppression du document`
      console.error(`Failed to delete ${type} ${id}:`, err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Valide un document
   * @param {Object} document - Document à valider
   */
  async function validate(document) {
    try {
      const result = await window.electronAPI.validateDocument(type, document)
      return result
    } catch (err) {
      console.error(`Failed to validate ${type}:`, err)
      throw err
    }
  }

  /**
   * Nombre total de documents
   */
  const count = computed(() => documents.value.length)

  /**
   * Documents triés par date décroissante
   */
  const sortedByDate = computed(() => {
    return [...documents.value].sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
  })

  return {
    // État
    documents,
    loading,
    error,

    // Computed
    count,
    sortedByDate,

    // Méthodes
    loadAll,
    loadOne,
    save,
    remove,
    validate
  }
}
