import { ref, computed, toRaw } from "vue";

/**
 * Composable pour gérer la numérotation automatique des documents
 * @param {string} type - 'devis' ou 'factures'
 * @returns {Object} Méthodes pour gérer la numérotation
 */
export function useNumbering(type) {
  const config = ref(null);
  const loading = ref(false);

  /**
   * Charge la configuration
   */
  async function loadConfig() {
    if (!config.value) {
      config.value = await window.electronAPI.loadConfig();
    }
    return config.value;
  }

  /**
   * Calcule le prochain numéro disponible
   */
  const nextNumber = computed(() => {
    if (!config.value) return "";

    const prefix = type === "devis" ? "D" : "F";
    const latestKey =
      type === "devis" ? "latestQuoteNumber" : "latestInvoiceNumber";
    const nextNum = (config.value.billing[latestKey] || 0) + 1;

    // Format avec 6 chiffres (padding avec des zéros)
    return `${prefix}${String(nextNum).padStart(6, "0")}`;
  });

  /**
   * Incrémente le compteur de numérotation et sauvegarde
   * @param {string} numero - Numéro qui vient d'être utilisé
   */
  async function incrementNumber(numero) {
    loading.value = true;

    try {
      await loadConfig();

      // Extraire le numéro du format D000001 ou F000001
      const numericPart = parseInt(numero.substring(1), 10);

      if (isNaN(numericPart)) {
        throw new Error("Numéro invalide");
      }

      const latestKey =
        type === "devis" ? "latestQuoteNumber" : "latestInvoiceNumber";

      // Mettre à jour seulement si le nouveau numéro est supérieur à l'actuel
      if (numericPart > config.value.billing[latestKey]) {
        config.value.billing[latestKey] = numericPart;
        await window.electronAPI.saveConfig(JSON.parse(JSON.stringify(toRaw(config.value))));
      }

      return true;
    } catch (err) {
      console.error("Failed to increment number:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Valide le format d'un numéro
   * @param {string} numero - Numéro à valider
   * @returns {boolean}
   */
  function isValidFormat(numero) {
    const prefix = type === "devis" ? "D" : "F";
    const regex = new RegExp(`^${prefix}\\d{6}$`);
    return regex.test(numero);
  }

  /**
   * Vérifie si un numéro est déjà utilisé
   * @param {string} numero - Numéro à vérifier
   * @param {Array} existingDocuments - Documents existants
   * @returns {boolean}
   */
  function isNumberUsed(numero, existingDocuments = []) {
    return existingDocuments.some((doc) => doc.numero === numero);
  }

  /**
   * Génère un numéro personnalisé
   * @param {number} num - Numéro sans préfixe
   * @returns {string}
   */
  function formatNumber(num) {
    const prefix = type === "devis" ? "D" : "F";
    return `${prefix}${String(num).padStart(6, "0")}`;
  }

  return {
    // État
    config,
    loading,

    // Computed
    nextNumber,

    // Méthodes
    loadConfig,
    incrementNumber,
    isValidFormat,
    isNumberUsed,
    formatNumber,
  };
}
