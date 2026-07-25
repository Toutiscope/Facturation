import { ref, reactive } from "vue";

/**
 * Couche logique réutilisable pour piloter la sauvegarde en ligne depuis la vue.
 * Chaque appel IPC renvoie { ok, data?, error? } : on déballe `data` ou on lève
 * une Error avec le message serveur (même contrat que les IPC pdp:*).
 */
export function useBackup() {
  const status = ref(null);
  const loading = ref(false);
  const backups = ref([]);
  const testResult = ref(null);
  const busy = reactive({
    connecting: false,
    savingPassphrase: false,
    backingUp: false,
    testing: false,
    listing: false,
    restoring: false,
    signingOut: false,
  });

  async function call(method, ...args) {
    const res = await window.electronAPI.backup[method](...args);
    if (!res || !res.ok) {
      throw new Error(
        (res && res.error && res.error.message) ||
          "Opération de sauvegarde échouée",
      );
    }
    return res.data;
  }

  async function loadStatus() {
    loading.value = true;
    try {
      status.value = await call("getStatus");
      return status.value;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Enregistre la config Supabase puis connecte le compte, en une étape.
   * @param {Object} settings - { supabaseUrl, anonKey, bucket, retention }
   * @param {string} email
   * @param {string} password
   */
  async function connect(settings, email, password) {
    busy.connecting = true;
    try {
      await call("configure", settings);
      const result = await call("signIn", email, password);
      await loadStatus();
      return result;
    } finally {
      busy.connecting = false;
    }
  }

  async function signOut() {
    busy.signingOut = true;
    try {
      await call("signOut");
      await loadStatus();
    } finally {
      busy.signingOut = false;
    }
  }

  async function savePassphrase(passphrase) {
    busy.savingPassphrase = true;
    try {
      await call("setPassphrase", passphrase);
      await loadStatus();
    } finally {
      busy.savingPassphrase = false;
    }
  }

  async function test() {
    busy.testing = true;
    testResult.value = null;
    try {
      await call("test");
      testResult.value = { ok: true };
    } catch (err) {
      testResult.value = { ok: false, message: err.message };
    } finally {
      busy.testing = false;
    }
    return testResult.value;
  }

  async function runNow() {
    busy.backingUp = true;
    try {
      const result = await call("runNow");
      await loadStatus();
      return result;
    } finally {
      busy.backingUp = false;
    }
  }

  async function listBackups() {
    busy.listing = true;
    try {
      backups.value = await call("list");
      return backups.value;
    } finally {
      busy.listing = false;
    }
  }

  async function restore(name, passphrase) {
    busy.restoring = true;
    try {
      return await call("restore", name, passphrase || undefined);
    } finally {
      busy.restoring = false;
    }
  }

  /**
   * Ouvre le sélecteur natif pour choisir un fichier .fbak.
   * @returns {Promise<{ canceled: boolean, fileName?: string }>}
   */
  async function pickFile() {
    return call("pickFile");
  }

  /** Restaure depuis le fichier .fbak précédemment sélectionné. */
  async function restoreFromFile(passphrase) {
    busy.restoring = true;
    try {
      return await call("restoreFromFile", passphrase || undefined);
    } finally {
      busy.restoring = false;
    }
  }

  return {
    status,
    loading,
    backups,
    testResult,
    busy,
    loadStatus,
    connect,
    signOut,
    savePassphrase,
    test,
    runNow,
    listBackups,
    restore,
    pickFile,
    restoreFromFile,
  };
}
