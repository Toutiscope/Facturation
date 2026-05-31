import { ref } from "vue";

/**
 * Recherche d'entreprises françaises par nom (ou SIREN/SIRET) via l'API publique
 * « Recherche d'Entreprises » (exposée côté main par l'IPC `company:search`).
 *
 * Gère le debounce, l'état de chargement/erreur et l'ignore des réponses périmées
 * (une requête lente ne doit pas écraser le résultat d'une frappe plus récente).
 *
 * @param {{ minLength?: number, debounceMs?: number }} [options]
 */
export function useCompanySearch({ minLength = 3, debounceMs = 300 } = {}) {
  const results = ref([]);
  const loading = ref(false);
  const error = ref(null);

  let debounceTimer = null;
  // Identifiant de requête : seule la réponse de la dernière requête émise est appliquée.
  let requestId = 0;

  async function runSearch(query) {
    const q = (query || "").trim();
    const currentId = ++requestId;

    if (q.length < minLength) {
      results.value = [];
      loading.value = false;
      error.value = null;
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const res = await window.electronAPI.searchCompanies(q);
      if (currentId !== requestId) return; // réponse périmée → ignorée

      if (res && res.ok) {
        results.value = res.data || [];
      } else {
        results.value = [];
        error.value = res?.error?.message || "Recherche indisponible";
      }
    } catch (err) {
      if (currentId !== requestId) return;
      results.value = [];
      error.value = "Recherche indisponible";
      console.error("useCompanySearch:", err);
    } finally {
      if (currentId === requestId) loading.value = false;
    }
  }

  /**
   * Déclenche une recherche debouncée. À appeler à chaque frappe.
   * @param {string} query
   */
  function search(query) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runSearch(query), debounceMs);
  }

  /** Réinitialise l'état et annule toute recherche en attente. */
  function clear() {
    if (debounceTimer) clearTimeout(debounceTimer);
    requestId++; // invalide une éventuelle réponse en vol
    results.value = [];
    loading.value = false;
    error.value = null;
  }

  return { results, loading, error, search, clear };
}
