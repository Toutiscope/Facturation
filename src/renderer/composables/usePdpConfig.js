import { ref, computed } from "vue";

export const PDP_PROVIDERS = [
  { value: "", label: "Aucune (désactivée)", defaultUrlApi: "" },
  { value: "superpdp", label: "SuperPDP", defaultUrlApi: "https://api.superpdp.tech" },
];

/**
 * Petite couche logique réutilisable pour piloter la configuration PDP depuis la vue.
 *
 * Ne gère PAS la persistance de `config.einvoicePlatform` (laissée à Settings.vue qui
 * possède déjà sa propre logique de sauvegarde unifiée). Gère par contre la persistance
 * des credentials chiffrés via les IPC `pdp:*`.
 */
export function usePdpConfig() {
  const hasCredentials = ref(false);
  const checkingCredentials = ref(false);
  const savingCredentials = ref(false);
  const deletingCredentials = ref(false);

  const testing = ref(false);
  const testResult = ref(null); // { ok: true, company } | { ok: false, message }

  const editingCredentials = ref(false);
  const credentialsDraft = ref({ client_id: "", client_secret: "" });

  const providerOptions = computed(() => PDP_PROVIDERS);

  function findProvider(value) {
    return PDP_PROVIDERS.find((p) => p.value === value);
  }

  function defaultUrlApiFor(providerName) {
    const p = findProvider(providerName);
    return p ? p.defaultUrlApi : "";
  }

  async function refreshHasCredentials(providerName) {
    if (!providerName) {
      hasCredentials.value = false;
      return false;
    }
    checkingCredentials.value = true;
    try {
      const result = await window.electronAPI.pdp.hasCredentials(providerName);
      hasCredentials.value = Boolean(result && result.ok && result.data?.hasCredentials);
      return hasCredentials.value;
    } finally {
      checkingCredentials.value = false;
    }
  }

  function startEditingCredentials() {
    credentialsDraft.value = { client_id: "", client_secret: "" };
    editingCredentials.value = true;
    testResult.value = null;
  }

  function cancelEditingCredentials() {
    credentialsDraft.value = { client_id: "", client_secret: "" };
    editingCredentials.value = false;
  }

  async function saveCredentials(providerName, platform) {
    if (!providerName) throw new Error("Sélectionner d'abord une plateforme PDP");
    if (!credentialsDraft.value.client_id || !credentialsDraft.value.client_secret) {
      throw new Error("client_id et client_secret requis");
    }

    savingCredentials.value = true;
    try {
      const result = await window.electronAPI.pdp.saveCredentials(
        providerName,
        { ...credentialsDraft.value },
        platform,
      );
      if (!result.ok) {
        throw new Error(result.error?.message || "Sauvegarde des identifiants échouée");
      }
      hasCredentials.value = true;
      editingCredentials.value = false;
      credentialsDraft.value = { client_id: "", client_secret: "" };
    } finally {
      savingCredentials.value = false;
    }
  }

  async function deleteCredentials(providerName) {
    if (!providerName) return;
    deletingCredentials.value = true;
    try {
      const result = await window.electronAPI.pdp.deleteCredentials(providerName);
      if (!result.ok) {
        throw new Error(result.error?.message || "Suppression échouée");
      }
      hasCredentials.value = false;
      testResult.value = null;
    } finally {
      deletingCredentials.value = false;
    }
  }

  async function testConnection(platform) {
    testing.value = true;
    testResult.value = null;
    try {
      const result = await window.electronAPI.pdp.testConnection(platform);
      if (!result.ok) {
        testResult.value = {
          ok: false,
          message: result.error?.message || "Connexion impossible",
          code: result.error?.code,
          status: result.error?.status,
        };
        return testResult.value;
      }
      testResult.value = {
        ok: true,
        company: result.data?.company,
        session: result.data?.session,
      };
      return testResult.value;
    } finally {
      testing.value = false;
    }
  }

  function clearTestResult() {
    testResult.value = null;
  }

  return {
    // state
    hasCredentials,
    checkingCredentials,
    savingCredentials,
    deletingCredentials,
    testing,
    testResult,
    editingCredentials,
    credentialsDraft,
    providerOptions,
    // helpers
    findProvider,
    defaultUrlApiFor,
    refreshHasCredentials,
    startEditingCredentials,
    cancelEditingCredentials,
    saveCredentials,
    deleteCredentials,
    testConnection,
    clearTestResult,
  };
}
