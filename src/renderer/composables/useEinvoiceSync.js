import { ref } from "vue";

/**
 * Synchronisation des statuts de cycle de vie des factures avec la PDP.
 * Encapsule l'appel IPC `pdp:sync` et son état réactif.
 */
export function useEinvoiceSync() {
  const syncing = ref(false);
  const lastResult = ref(null);

  /**
   * Déclenche une synchronisation.
   * @returns {Promise<{ ok: boolean, data?: object, error?: object }>}
   */
  async function sync() {
    if (syncing.value) return { ok: false, error: { message: "Déjà en cours" } };
    syncing.value = true;
    try {
      const result = await window.electronAPI.pdp.sync();
      lastResult.value = result;
      return result;
    } finally {
      syncing.value = false;
    }
  }

  return { syncing, lastResult, sync };
}
