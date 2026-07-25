<template>
  <section class="card settings-card backup-section">
    <p class="backup-intro">
      Sauvegardez automatiquement vos devis, factures et paramètres, chiffrés de
      bout en bout, sur votre espace Supabase privé. Vos données restent
      illisibles pour l'hébergeur : seule votre phrase de récupération permet de
      les déchiffrer.
    </p>

    <div v-if="backup.loading.value" class="backup-loading">Chargement…</div>

    <template v-else-if="status">
      <!-- ── 1. Connexion au compte ─────────────────────────── -->
      <div class="backup-block">
        <div class="backup-block__head">
          <strong>1. Connexion à Supabase</strong>
          <span v-if="status.signedIn" class="badge badge-success">
            Connectée
          </span>
          <span v-else class="badge badge-warning">Non connectée</span>
        </div>

        <template v-if="status.signedIn">
          <p class="backup-hint">
            Connectée en tant que <strong>{{ status.userEmail }}</strong
            >.
          </p>
          <div class="backup-actions">
            <button
              type="button"
              class="btn btn-outline btn-sm"
              :disabled="busy.testing"
              @click="onTest"
            >
              {{ busy.testing ? "Test en cours…" : "Tester l'accès" }}
            </button>
            <button
              type="button"
              class="btn btn-danger btn-sm"
              :disabled="busy.signingOut"
              @click="onSignOut"
            >
              {{ busy.signingOut ? "Déconnexion…" : "Se déconnecter" }}
            </button>
          </div>
        </template>

        <template v-else>
          <div class="form-group">
            <label>URL du projet Supabase</label>
            <input
              v-model="form.supabaseUrl"
              type="text"
              placeholder="https://xxxx.supabase.co"
            />
            <small>Réglages → API → Project URL</small>
          </div>
          <div class="form-group">
            <label>Clé anon (public)</label>
            <input
              v-model="form.anonKey"
              type="text"
              autocomplete="off"
              placeholder="eyJhbGciOi…"
            />
            <small>
              Réglages → API → Project API keys → <code>anon</code>. Cette clé
              est publique par nature.
            </small>
          </div>
          <div class="form-group">
            <label>Nom du bucket</label>
            <input v-model="form.bucket" type="text" placeholder="backups" />
          </div>
          <div class="form-group">
            <label>Email du compte de sauvegarde</label>
            <input
              v-model="form.email"
              type="email"
              autocomplete="off"
              placeholder="backup@exemple.fr"
            />
            <small>L'utilisateur créé dans Supabase (Authentication).</small>
          </div>
          <div class="form-group">
            <label>Mot de passe</label>
            <input
              v-model="form.password"
              type="password"
              autocomplete="off"
              placeholder="••••••••"
            />
            <small>Jamais enregistré : seule la session sécurisée l'est.</small>
          </div>

          <div v-if="connectError" class="error-message">
            {{ connectError }}
          </div>

          <div class="backup-actions">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="busy.connecting"
              @click="onConnect"
            >
              {{ busy.connecting ? "Connexion…" : "Enregistrer et connecter" }}
            </button>
          </div>
        </template>

        <div
          v-if="testResult"
          class="backup-result"
          :class="testResult.ok ? 'backup-result--ok' : 'backup-result--err'"
        >
          <template v-if="testResult.ok">Accès au bucket confirmé ✓</template>
          <template v-else>Échec : {{ testResult.message }}</template>
        </div>
      </div>

      <!-- ── 2. Phrase de récupération ──────────────────────── -->
      <div class="backup-block">
        <div class="backup-block__head">
          <strong>2. Phrase de récupération</strong>
          <span v-if="status.hasPassphrase" class="badge badge-success">
            Définie
          </span>
          <span v-else class="badge badge-warning">À définir</span>
        </div>

        <div class="backup-warning">
          ⚠️ Cette phrase chiffre vos sauvegardes. <strong>Notez-la
          précieusement</strong> et conservez-la ailleurs que sur ce PC : sans
          elle, une sauvegarde est <strong>définitivement illisible</strong>,
          même pour vous. C'est le prix d'une sauvegarde restaurable sur un
          ordinateur neuf.
        </div>

        <template v-if="!status.hasPassphrase || changingPassphrase">
          <div class="form-group">
            <label>Phrase de récupération (8 caractères minimum)</label>
            <input
              v-model="form.passphrase"
              type="text"
              autocomplete="off"
              placeholder="Ex : quatre-mots-simples-a-retenir"
            />
          </div>
          <div class="form-group">
            <label>Confirmez la phrase</label>
            <input
              v-model="form.passphraseConfirm"
              type="text"
              autocomplete="off"
              placeholder="Retapez la même phrase"
            />
          </div>
          <div v-if="passphraseError" class="error-message">
            {{ passphraseError }}
          </div>
          <div class="backup-actions">
            <button
              v-if="changingPassphrase"
              type="button"
              class="btn btn-secondary btn-sm"
              @click="cancelPassphrase"
            >
              Annuler
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="busy.savingPassphrase"
              @click="onSavePassphrase"
            >
              {{ busy.savingPassphrase ? "Enregistrement…" : "Définir la phrase" }}
            </button>
          </div>
        </template>
        <div v-else class="backup-actions">
          <button
            type="button"
            class="btn btn-outline btn-sm"
            @click="startChangingPassphrase"
          >
            Changer la phrase
          </button>
          <small class="backup-hint">
            Changer la phrase n'affecte que les <em>prochaines</em> sauvegardes.
          </small>
        </div>
      </div>

      <!-- ── 3. Sauvegarde ──────────────────────────────────── -->
      <div v-if="ready" class="backup-block">
        <div class="backup-block__head">
          <strong>3. Sauvegarde</strong>
        </div>

        <p class="backup-hint">
          <template v-if="status.lastBackupAt">
            Dernière sauvegarde :
            <strong>{{ formatDate(status.lastBackupAt) }}</strong>
          </template>
          <template v-else>Aucune sauvegarde effectuée pour l'instant.</template>
        </p>
        <p v-if="status.lastError" class="backup-hint backup-hint--error">
          Dernière erreur : {{ status.lastError }}
        </p>

        <div class="backup-actions">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="busy.backingUp"
            @click="onBackupNow"
          >
            {{ busy.backingUp ? "Sauvegarde en cours…" : "Sauvegarder maintenant" }}
          </button>
          <button
            type="button"
            class="btn btn-outline btn-sm"
            :disabled="busy.listing"
            @click="toggleList"
          >
            {{ showList ? "Masquer" : "Voir les sauvegardes" }}
          </button>
        </div>

        <div v-if="showList" class="backup-list">
          <p v-if="busy.listing" class="backup-hint">Chargement…</p>
          <p v-else-if="backup.backups.value.length === 0" class="backup-hint">
            Aucune sauvegarde en ligne pour l'instant.
          </p>
          <ul v-else>
            <li v-for="b in backup.backups.value" :key="b.name">
              <span>{{ formatDate(b.updatedAt) || b.name }}</span>
              <span class="backup-list__right">
                <small v-if="b.size">{{ formatSize(b.size) }}</small>
                <button
                  type="button"
                  class="btn btn-outline btn-sm"
                  :disabled="busy.restoring"
                  @click="selectForRestore(b)"
                >
                  Restaurer
                </button>
              </span>
            </li>
          </ul>
          <small class="backup-hint">
            {{ status.retention }} sauvegardes les plus récentes conservées.
          </small>
        </div>

        <!-- Panneau de restauration -->
        <div v-if="selectedBackup" class="backup-restore">
          <strong>
            Restaurer la sauvegarde du
            {{ formatDate(selectedBackup.updatedAt) || selectedBackup.name }}
          </strong>
          <p class="backup-hint">
            Vos données locales actuelles seront remplacées par le contenu de
            cette sauvegarde. Une copie de sécurité de vos données actuelles est
            créée automatiquement juste avant.
          </p>
          <div class="form-group">
            <label>Phrase de récupération</label>
            <input
              v-model="restorePassphrase"
              type="text"
              autocomplete="off"
              placeholder="Laissez vide pour utiliser la phrase enregistrée"
            />
            <small>
              À saisir uniquement si cette sauvegarde a été chiffrée avec une
              autre phrase (ex. restauration sur un nouvel ordinateur).
            </small>
          </div>
          <div v-if="restoreError" class="error-message">
            {{ restoreError }}
          </div>
          <div class="backup-actions">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              @click="cancelRestore"
            >
              Annuler
            </button>
            <button
              type="button"
              class="btn btn-danger btn-sm"
              :disabled="busy.restoring"
              @click="showRestoreConfirm = true"
            >
              {{ busy.restoring ? "Restauration…" : "Restaurer cette sauvegarde" }}
            </button>
          </div>
        </div>

      </div>

      <!-- Restaurer depuis un fichier .fbak (toujours disponible) -->
      <div class="backup-block">
        <div class="backup-block__head">
          <strong>Restaurer depuis un fichier</strong>
        </div>
        <p class="backup-hint">
          Vous avez un fichier de sauvegarde (.fbak) — téléchargé depuis
          Supabase ou copié sur une clé USB ? Restaurez-le directement, même
          sans être connectée (utile pour repartir d'un ordinateur neuf).
        </p>
        <div class="form-group">
          <label>Phrase de récupération</label>
          <input
            v-model="importPassphrase"
            type="text"
            autocomplete="off"
            placeholder="Laissez vide pour utiliser la phrase enregistrée"
          />
          <small>
            Obligatoire si aucune phrase n'est enregistrée sur ce poste.
          </small>
        </div>
        <div v-if="!importFileName" class="backup-actions">
          <button
            type="button"
            class="btn btn-outline btn-sm"
            :disabled="busy.restoring"
            @click="onPickFile"
          >
            Choisir un fichier .fbak…
          </button>
        </div>
        <div v-else class="backup-restore">
          <strong>Fichier sélectionné : {{ importFileName }}</strong>
          <p class="backup-hint">
            Vos données locales actuelles seront remplacées (une copie de
            sécurité est créée automatiquement avant).
          </p>
          <div v-if="importError" class="error-message">{{ importError }}</div>
          <div class="backup-actions">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              @click="cancelImport"
            >
              Annuler
            </button>
            <button
              type="button"
              class="btn btn-danger btn-sm"
              :disabled="busy.restoring"
              @click="showImportConfirm = true"
            >
              {{ busy.restoring ? "Restauration…" : "Restaurer depuis ce fichier" }}
            </button>
          </div>
        </div>
      </div>

      <!-- Succès de restauration (partagé : en ligne ou fichier) -->
      <div v-if="restoreResult" class="backup-restore-success">
        <p>
          <strong>Restauration réussie</strong> —
          {{ restoreResult.restored }} fichier(s) restauré(s).
        </p>
        <p class="backup-hint">
          Une copie de vos données précédentes a été conservée dans :<br />
          <code>{{ restoreResult.safetyCopy }}</code>
        </p>
        <p class="backup-hint">
          Redémarrez l'application pour charger les données restaurées.
        </p>
        <button type="button" class="btn btn-primary btn-sm" @click="restartApp">
          Redémarrer maintenant
        </button>
      </div>
    </template>

    <ConfirmModal
      :visible="showRestoreConfirm"
      title="Restaurer cette sauvegarde ?"
      warning="Vos données locales actuelles seront remplacées (une copie de sécurité est créée avant)."
      confirm-label="Restaurer"
      @cancel="showRestoreConfirm = false"
      @confirm="doRestore"
    >
      Le contenu de cette sauvegarde va écraser vos devis, factures, clients et
      paramètres locaux.
    </ConfirmModal>

    <ConfirmModal
      :visible="showImportConfirm"
      title="Restaurer depuis ce fichier ?"
      warning="Vos données locales actuelles seront remplacées (une copie de sécurité est créée avant)."
      confirm-label="Restaurer"
      @cancel="showImportConfirm = false"
      @confirm="doImportRestore"
    >
      Le contenu de ce fichier va écraser vos devis, factures, clients et
      paramètres locaux.
    </ConfirmModal>
  </section>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useBackup } from "@/composables/useBackup";
import { useToast } from "@/composables/useToast";
import ConfirmModal from "@/components/common/ConfirmModal.vue";

const backup = useBackup();
const { busy, testResult, status } = backup;
const { showToast } = useToast();

const form = reactive({
  supabaseUrl: "",
  anonKey: "",
  bucket: "backups",
  email: "",
  password: "",
  passphrase: "",
  passphraseConfirm: "",
});

const connectError = ref("");
const passphraseError = ref("");
const changingPassphrase = ref(false);
const showList = ref(false);

// Restauration (depuis le listing en ligne)
const selectedBackup = ref(null);
const restorePassphrase = ref("");
const showRestoreConfirm = ref(false);
const restoreResult = ref(null);
const restoreError = ref("");

// Restauration depuis un fichier .fbak importé
const importPassphrase = ref("");
const importFileName = ref("");
const showImportConfirm = ref(false);
const importError = ref("");

// Prêt à sauvegarder : compte connecté + phrase définie.
const ready = computed(
  () => status.value && status.value.signedIn && status.value.hasPassphrase,
);

onMounted(async () => {
  await backup.loadStatus();
  if (status.value) {
    form.supabaseUrl = status.value.supabaseUrl || "";
    form.anonKey = status.value.anonKey || "";
    form.bucket = status.value.bucket || "backups";
    form.email = status.value.userEmail || "";
  }
});

async function onConnect() {
  connectError.value = "";
  try {
    await backup.connect(
      {
        supabaseUrl: form.supabaseUrl,
        anonKey: form.anonKey,
        bucket: form.bucket,
        retention: 15,
      },
      form.email,
      form.password,
    );
    form.password = "";
    showToast("Connexion à Supabase réussie", "success");
  } catch (err) {
    connectError.value = err.message;
  }
}

async function onSignOut() {
  await backup.signOut();
}

async function onTest() {
  await backup.test();
}

function startChangingPassphrase() {
  changingPassphrase.value = true;
  form.passphrase = "";
  form.passphraseConfirm = "";
  passphraseError.value = "";
}

function cancelPassphrase() {
  changingPassphrase.value = false;
  form.passphrase = "";
  form.passphraseConfirm = "";
  passphraseError.value = "";
}

async function onSavePassphrase() {
  passphraseError.value = "";
  if (form.passphrase.trim().length < 8) {
    passphraseError.value = "8 caractères minimum.";
    return;
  }
  if (form.passphrase !== form.passphraseConfirm) {
    passphraseError.value = "Les deux phrases ne correspondent pas.";
    return;
  }
  try {
    await backup.savePassphrase(form.passphrase);
    changingPassphrase.value = false;
    form.passphrase = "";
    form.passphraseConfirm = "";
    showToast("Phrase de récupération enregistrée", "success");
  } catch (err) {
    passphraseError.value = err.message;
  }
}

async function onBackupNow() {
  try {
    const result = await backup.runNow();
    showToast(
      `Sauvegarde effectuée${result.pruned ? ` (${result.pruned} ancienne(s) supprimée(s))` : ""}`,
      "success",
    );
    if (showList.value) await backup.listBackups();
  } catch (err) {
    showToast(`Échec de la sauvegarde : ${err.message}`, "error");
  }
}

async function toggleList() {
  showList.value = !showList.value;
  if (showList.value) await backup.listBackups();
}

function selectForRestore(b) {
  selectedBackup.value = b;
  restorePassphrase.value = "";
  restoreError.value = "";
  restoreResult.value = null;
}

function cancelRestore() {
  selectedBackup.value = null;
  restorePassphrase.value = "";
  restoreError.value = "";
}

async function doRestore() {
  showRestoreConfirm.value = false;
  restoreError.value = "";
  try {
    const result = await backup.restore(
      selectedBackup.value.name,
      restorePassphrase.value.trim(),
    );
    restoreResult.value = result;
    selectedBackup.value = null;
    restorePassphrase.value = "";
  } catch (err) {
    restoreError.value = err.message;
  }
}

async function onPickFile() {
  importError.value = "";
  try {
    const res = await backup.pickFile();
    if (res && !res.canceled) {
      importFileName.value = res.fileName;
      restoreResult.value = null;
    }
  } catch (err) {
    importError.value = err.message;
  }
}

function cancelImport() {
  importFileName.value = "";
  importError.value = "";
}

async function doImportRestore() {
  showImportConfirm.value = false;
  importError.value = "";
  try {
    const result = await backup.restoreFromFile(importPassphrase.value.trim());
    restoreResult.value = result;
    importFileName.value = "";
    importPassphrase.value = "";
  } catch (err) {
    importError.value = err.message;
  }
}

function restartApp() {
  window.electronAPI.restartApp();
}

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatSize(bytes) {
  if (!bytes) return "";
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} Ko` : `${(kb / 1024).toFixed(1)} Mo`;
}
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.backup-section {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.backup-intro {
  color: $grey-80;
  margin: 0;
}

.backup-loading {
  color: $grey-70;
}

.backup-block {
  padding: $spacing-md;
  border: 1px solid $grey-20;
  border-radius: $border-radius-md;
  background: $grey-10;
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.backup-block__head {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.backup-hint {
  color: $grey-70;
  font-size: $font-size-sm;
  margin: 0;

  &--error {
    color: $error-color;
  }
}

.backup-warning {
  background: rgba($warning-color, 0.12);
  border: 1px solid rgba($warning-color, 0.35);
  border-radius: $border-radius-sm;
  padding: $spacing-sm $spacing-md;
  font-size: $font-size-sm;
  color: $grey-90;
}

.backup-actions {
  display: flex;
  gap: $spacing-sm;
  flex-wrap: wrap;
  align-items: center;
}

.backup-result {
  padding: $spacing-sm $spacing-md;
  border-radius: $border-radius-sm;
  font-size: $font-size-sm;

  &--ok {
    background: rgba($success-color, 0.1);
    color: $success-color;
    border: 1px solid rgba($success-color, 0.3);
  }

  &--err {
    background: rgba($error-color, 0.1);
    color: $error-color;
    border: 1px solid rgba($error-color, 0.3);
  }
}

.backup-list {
  ul {
    list-style: none;
    padding: 0;
    margin: 0 0 $spacing-sm;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    border-bottom: 1px solid $grey-20;
    font-size: $font-size-sm;

    small {
      color: $grey-60;
    }
  }

  &__right {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }
}

.backup-restore {
  padding: $spacing-md;
  border: 1px solid rgba($error-color, 0.35);
  border-radius: $border-radius-md;
  background: rgba($error-color, 0.05);
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.backup-restore-success {
  padding: $spacing-md;
  border: 1px solid rgba($success-color, 0.3);
  border-radius: $border-radius-md;
  background: rgba($success-color, 0.08);
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  code {
    word-break: break-all;
    font-size: $font-size-xs;
  }
}

.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: $border-radius-pill;
  font-size: $font-size-xs;
  font-weight: 500;

  &.badge-success {
    background: rgba($success-color, 0.15);
    color: $success-color;
  }

  &.badge-warning {
    background: rgba($warning-color, 0.15);
    color: $warning-color;
  }
}
</style>
