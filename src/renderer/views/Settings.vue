<template>
  <div class="settings">
    <header class="settings-header">
      <h1>Mes paramètres</h1>
      <div class="update-check">
        <button
          type="button"
          class="btn btn-outline"
          :disabled="checkingUpdate"
          @click="checkForUpdates"
        >
          {{
            checkingUpdate
              ? "Recherche en cours..."
              : "Chercher des mises à jour"
          }}
        </button>
        <small v-if="updateCheckMessage" :class="updateCheckMessageClass">
          {{ updateCheckMessage }}
        </small>
      </div>
    </header>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>Chargement de la configuration...</p>
    </div>

    <form v-else class="settings-form" @submit.prevent="saveConfig">
      <!-- Erreur générale -->
      <div v-if="errors.general" class="errors-list">
        <h3>Erreur</h3>
        <p>{{ errors.general }}</p>
      </div>

      <!-- Message de succès -->
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>

      <div class="settings-grid flex flex-column gap-16">
        <h2 class="mg-top-24">Mes informations</h2>
        <!-- Section Entreprise -->
        <section class="card settings-card grid grid--cols-3 gap-64 grid-start">
          <div>
            <h2>Entreprise</h2>

            <!-- Logo upload -->
            <div class="form-group logo-upload pd-bottom-8">
              <label>Logo de l'entreprise</label>
              <div class="logo-upload__container">
                <div v-if="logoPreview" class="logo-upload__preview">
                  <img :src="logoPreview" alt="Logo" />
                </div>
                <div v-else class="logo-upload__placeholder">
                  <svg
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="6"
                      y="6"
                      width="36"
                      height="36"
                      rx="4"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-dasharray="4 4"
                    />
                    <path
                      d="M18 30l4-5 3 3 5-7 6 9H12z"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linejoin="round"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="3"
                      stroke="currentColor"
                      stroke-width="1.5"
                    />
                  </svg>
                </div>
                <div class="logo-upload__actions">
                  <button
                    type="button"
                    class="btn btn-outline btn-sm"
                    :disabled="uploadingLogo"
                    @click="uploadLogo"
                  >
                    {{
                      uploadingLogo
                        ? "Chargement..."
                        : logoPreview
                          ? "Changer"
                          : "Choisir un logo"
                    }}
                  </button>
                  <button
                    v-if="logoPreview"
                    type="button"
                    class="btn btn-danger btn-sm"
                    @click="removeLogo"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
              <small>PNG ou JPG</small>
            </div>

            <div class="form-group">
              <label>Nom de l'entreprise *</label>
              <input
                v-model="config.company.companyName"
                type="text"
                :class="{ error: errors.companyName }"
                placeholder="Ex: SARL Dupont Services"
              />
              <span v-if="errors.companyName" class="error-message">
                {{ errors.companyName }}
              </span>
            </div>

            <div class="form-group">
              <label>Nom et prénom du dirigeant</label>
              <input
                v-model="config.company.ownerName"
                type="text"
                placeholder="Jean Dupont"
              />
            </div>
          </div>

          <div>
            <div class="form-group">
              <label>Adresse du siège social</label>
              <input
                v-model="config.company.registeredAddress"
                type="text"
                placeholder="123 Rue Example, 44000 Nantes"
              />
              <small>Apparaît en pied de page des documents</small>
            </div>

            <div class="form-group">
              <label>Adresse (n° et rue) *</label>
              <input
                v-model="config.company.address"
                type="text"
                :class="{ error: errors.address }"
                placeholder="123 Rue Example"
              />
              <span v-if="errors.address" class="error-message">
                {{ errors.address }}
              </span>
            </div>

            <div class="form-group">
              <label>Code postal *</label>
              <input
                v-model="config.company.postalCode"
                type="text"
                :class="{ error: errors.postalCode }"
                placeholder="44000"
                maxlength="5"
              />
              <span v-if="errors.postalCode" class="error-message">
                {{ errors.postalCode }}
              </span>
            </div>

            <div class="form-group">
              <label>Ville *</label>
              <input
                v-model="config.company.city"
                type="text"
                :class="{ error: errors.city }"
                placeholder="Nantes"
              />
              <span v-if="errors.city" class="error-message">
                {{ errors.city }}
              </span>
            </div>
          </div>

          <div>
            <div class="form-group">
              <label>SIRET *</label>
              <input
                v-model="config.company.companyId"
                type="text"
                :class="{ error: errors.companyId }"
                placeholder="123 456 789 00012"
                maxlength="14"
              />
              <small>14 chiffres obligatoires</small>
              <span v-if="errors.companyId" class="error-message">
                {{ errors.companyId }}
              </span>
            </div>

            <div class="form-group">
              <label>Email *</label>
              <input
                v-model="config.company.email"
                type="email"
                :class="{ error: errors.email }"
                placeholder="contact@exemple.fr"
              />
              <span v-if="errors.email" class="error-message">
                {{ errors.email }}
              </span>
            </div>

            <div class="form-group">
              <label>Téléphone</label>
              <input
                v-model="config.company.phoneNumber"
                type="tel"
                maxlength="10"
                placeholder="02 XX XX XX XX"
              />
            </div>

            <div class="form-group">
              <label>Site web</label>
              <input
                v-model="config.company.webSite"
                type="text"
                placeholder="https://www.exemple.fr"
              />
            </div>
          </div>
        </section>

        <h2 class="mg-top-24">Mentions légales</h2>
        <!-- Section RIB -->
        <div class="grid grid--cols-2 gap-16">
          <section class="card settings-card">
            <h2>Coordonnées bancaires</h2>

            <div class="form-group">
              <label>IBAN</label>
              <input
                v-model="config.rib.iban"
                type="text"
                placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
              />
              <small>Sera affiché sur les factures si rempli</small>
            </div>

            <div class="form-group">
              <label>BIC</label>
              <input
                v-model="config.rib.bic"
                type="text"
                placeholder="XXXXXXXX"
              />
            </div>

            <div class="form-group">
              <label>Titulaire du compte</label>
              <input
                v-model="config.rib.holder"
                type="text"
                placeholder="Nom du titulaire"
              />
            </div>
          </section>

          <div class="flex flex-column gap-16">
            <!-- Section Facturation -->
            <section class="card settings-card">
              <h2>Facturation</h2>

              <div class="form-group">
                <label>Mentions légales</label>
                <textarea
                  v-model="config.billing.legalNotice"
                  rows="2"
                  placeholder="Dispensé d'immatriculation..."
                ></textarea>
                <small>Mention obligatoire sur tous les documents</small>
              </div>

              <div class="form-group">
                <label>Conditions de paiement</label>
                <input
                  v-model="config.billing.paymentTerms"
                  type="text"
                  placeholder="Paiement à 30 jours"
                />
              </div>

              <div class="form-group">
                <label>Moyens de règlement</label>
                <input
                  v-model="config.billing.meansOfPayment"
                  type="text"
                  placeholder="Virement bancaire, chèque"
                />
                <small>Affiché sur les devis</small>
              </div>

              <div class="form-group">
                <label>Pénalités de retard</label>
                <textarea
                  v-model="config.billing.latePenalties"
                  rows="2"
                  placeholder="En cas de retard de paiement..."
                ></textarea>
              </div>
            </section>
          </div>
        </div>

        <h2 class="mg-top-24">Plateforme de facturation électronique</h2>
        <section class="card settings-card pdp-section">
          <p class="pdp-intro">
            Branchez votre plateforme agréée (PDP) pour envoyer vos factures au
            format électronique conformément à la réforme 2026-2027.
            <a
              href="#"
              @click.prevent="openExternal('https://www.superpdp.tech')"
              >Créer un compte SuperPDP</a
            >.
          </p>

          <div class="form-group">
            <label>Plateforme</label>
            <select
              v-model="config.einvoicePlatform.providerName"
              @change="onProviderChanged"
            >
              <option
                v-for="opt in pdp.providerOptions.value"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
            <small>
              SuperPDP est la plateforme par défaut. D'autres pourront être
              ajoutées sans modifier vos données.
            </small>
          </div>

          <template v-if="config.einvoicePlatform.providerName">
            <div class="form-group">
              <label>URL de l'API</label>
              <input
                v-model="config.einvoicePlatform.urlApi"
                type="text"
                placeholder="https://api.superpdp.tech"
              />
              <small>
                Laissez la valeur par défaut sauf indication contraire.
              </small>
            </div>

            <div class="form-group form-group--inline">
              <label class="checkbox-label">
                <input
                  v-model="config.einvoicePlatform.isSandbox"
                  type="checkbox"
                />
                <span>Utiliser l'environnement bac à sable</span>
              </label>
              <small>
                Active le mode test : aucune vraie facture n'est échangée.
              </small>
            </div>

            <div class="pdp-credentials">
              <div class="pdp-credentials__status">
                <strong>Identifiants OAuth2</strong>
                <span
                  v-if="pdp.checkingCredentials.value"
                  class="badge badge-grey"
                  >Vérification…</span
                >
                <span
                  v-else-if="pdp.hasCredentials.value"
                  class="badge badge-success"
                  >Configurés</span
                >
                <span v-else class="badge badge-warning">Non configurés</span>
              </div>

              <p
                v-if="!pdp.editingCredentials.value"
                class="pdp-credentials__hint"
              >
                Les identifiants sont chiffrés localement et ne sont jamais
                affichés en clair après sauvegarde.
              </p>

              <div
                v-if="pdp.editingCredentials.value"
                class="pdp-credentials__form"
              >
                <div class="form-group">
                  <label>client_id</label>
                  <input
                    v-model="pdp.credentialsDraft.value.client_id"
                    type="text"
                    autocomplete="off"
                    placeholder="Identifiant fourni par la PDP"
                  />
                </div>
                <div class="form-group">
                  <label>client_secret</label>
                  <input
                    v-model="pdp.credentialsDraft.value.client_secret"
                    :type="showSecret ? 'text' : 'password'"
                    autocomplete="off"
                    placeholder="Secret fourni par la PDP"
                  />
                  <button
                    type="button"
                    class="btn btn-outline btn-sm mg-top-8"
                    @click="showSecret = !showSecret"
                  >
                    {{ showSecret ? "Masquer" : "Afficher" }}
                  </button>
                </div>

                <div v-if="credentialsError" class="error-message">
                  {{ credentialsError }}
                </div>

                <div class="pdp-credentials__actions">
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    :disabled="pdp.savingCredentials.value"
                    @click="cancelCredentialsEdit"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    :disabled="pdp.savingCredentials.value"
                    @click="saveCredentials"
                  >
                    {{
                      pdp.savingCredentials.value
                        ? "Enregistrement…"
                        : "Enregistrer les identifiants"
                    }}
                  </button>
                </div>
              </div>

              <div v-else class="pdp-credentials__actions">
                <button
                  type="button"
                  class="btn btn-outline btn-sm"
                  @click="pdp.startEditingCredentials()"
                >
                  {{ pdp.hasCredentials.value ? "Modifier" : "Configurer" }}
                </button>
                <button
                  v-if="pdp.hasCredentials.value"
                  type="button"
                  class="btn btn-danger btn-sm"
                  :disabled="pdp.deletingCredentials.value"
                  @click="onDeleteCredentials"
                >
                  {{
                    pdp.deletingCredentials.value ? "Suppression…" : "Supprimer"
                  }}
                </button>
              </div>
            </div>

            <div class="pdp-test">
              <button
                type="button"
                class="btn btn-outline"
                :disabled="pdp.testing.value || !pdp.hasCredentials.value"
                @click="onTestConnection"
              >
                {{
                  pdp.testing.value ? "Test en cours…" : "Tester la connexion"
                }}
              </button>

              <div
                v-if="pdp.testResult.value && pdp.testResult.value.ok"
                class="pdp-test__result pdp-test__result--success"
              >
                Connexion OK — entreprise reconnue :
                <strong>{{
                  pdp.testResult.value.company?.formal_name ||
                  pdp.testResult.value.company?.name ||
                  "(nom indisponible)"
                }}</strong>
                <small v-if="pdp.testResult.value.session?.status">
                  Statut session : {{ pdp.testResult.value.session.status }}
                </small>
              </div>

              <div
                v-else-if="pdp.testResult.value && !pdp.testResult.value.ok"
                class="pdp-test__result pdp-test__result--error"
              >
                Échec :
                <span>{{ pdp.testResult.value.message }}</span>
                <small v-if="pdp.testResult.value.status">
                  Code HTTP {{ pdp.testResult.value.status }}
                </small>
              </div>
            </div>
          </template>
        </section>

        <h2 class="mg-top-24">Paramètres généraux</h2>
        <section class="card settings-card" style="width: calc(50% - 8px)">
          <div class="form-group">
            <label>Dernier n° de devis</label>
            <input
              v-model.number="config.billing.latestQuoteNumber"
              type="number"
              min="0"
            />
            <small>Numérotation automatique à partir de ce numéro</small>
          </div>

          <div class="form-group">
            <label>Dernier n° de facture</label>
            <input
              v-model.number="config.billing.latestInvoiceNumber"
              type="number"
              min="0"
            />
            <small>Numérotation automatique à partir de ce numéro</small>
          </div>

          <div class="form-group">
            <label>Dossier d'enregistrement des PDF</label>
            <div class="path-input">
              <input
                v-model="config.billing.pdfOutputPath"
                type="text"
                placeholder="Aucun dossier sélectionné"
                readonly
              />
              <button
                type="button"
                class="btn btn-outline btn-sm"
                :disabled="selectingFolder"
                @click="selectPdfFolder"
              >
                {{ selectingFolder ? "Chargement..." : "Parcourir" }}
              </button>
            </div>
            <small>Les PDF seront enregistrés dans ce dossier par défaut</small>
          </div>
        </section>

        <h2 class="mg-top-24">Sauvegarde en ligne</h2>
        <BackupSection />
      </div>

      <ConfirmModal
        :visible="showUnsavedModal"
        title="Modifications non sauvegardées"
        warning="Les modifications seront perdues si vous quittez cette page."
        confirm-label="Quitter sans sauvegarder"
        @cancel="showUnsavedModal = false"
        @confirm="confirmLeave"
      />

      <!-- Actions -->
      <div class="form-actions">
        <button
          type="button"
          class="btn btn-secondary"
          @click="router.push('/')"
        >
          Annuler
        </button>
        <button type="submit" :disabled="saving" class="btn btn-primary">
          {{
            saving ? "Sauvegarde en cours..." : "Sauvegarder la configuration"
          }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, toRaw, inject } from "vue";
import { useRouter, onBeforeRouteLeave } from "vue-router";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { usePdpConfig } from "@/composables/usePdpConfig";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import BackupSection from "@/components/settings/BackupSection.vue";

const router = useRouter();
const globalLogo = inject("logo");

const loading = ref(true);
const saving = ref(false);
const config = ref(null);
const errors = ref({});
const successMessage = ref("");
const logoPreview = ref(null);
const uploadingLogo = ref(false);
const selectingFolder = ref(false);
const checkingUpdate = ref(false);
const updateCheckMessage = ref("");
const updateCheckMessageClass = ref("");
const showUnsavedModal = ref(false);
const pendingRoute = ref(null);
let skipGuard = false;

// ── PDP ──────────────────────────────────────────────────────
const pdp = usePdpConfig();
const showSecret = ref(false);
const credentialsError = ref("");

const { isDirty, setInitialState, markAsSaved } = useUnsavedChanges(config);

onBeforeRouteLeave((to) => {
  if (skipGuard) {
    skipGuard = false;
    return true;
  }
  if (isDirty.value) {
    pendingRoute.value = to.fullPath;
    showUnsavedModal.value = true;
    return false;
  }
});

function confirmLeave() {
  showUnsavedModal.value = false;
  skipGuard = true;
  router.push(pendingRoute.value);
}

onMounted(async () => {
  try {
    config.value = await window.electronAPI.loadConfig();
    logoPreview.value = await window.electronAPI.getLogo();
    if (config.value.einvoicePlatform?.providerName) {
      await pdp.refreshHasCredentials(
        config.value.einvoicePlatform.providerName,
      );
    }
    setInitialState();
  } catch (error) {
    console.error("Failed to load config:", error);
    errors.value.general = "Impossible de charger la configuration";
  } finally {
    loading.value = false;
  }
});

async function onProviderChanged() {
  pdp.clearTestResult();
  credentialsError.value = "";

  const provider = pdp.findProvider(config.value.einvoicePlatform.providerName);
  if (provider && !config.value.einvoicePlatform.urlApi) {
    config.value.einvoicePlatform.urlApi = provider.defaultUrlApi;
  }
  await pdp.refreshHasCredentials(config.value.einvoicePlatform.providerName);
}

function cancelCredentialsEdit() {
  credentialsError.value = "";
  showSecret.value = false;
  pdp.cancelEditingCredentials();
}

async function saveCredentials() {
  credentialsError.value = "";
  try {
    await pdp.saveCredentials(config.value.einvoicePlatform.providerName, {
      providerName: config.value.einvoicePlatform.providerName,
      urlApi: config.value.einvoicePlatform.urlApi,
      isSandbox: config.value.einvoicePlatform.isSandbox,
    });
    showSecret.value = false;
  } catch (err) {
    credentialsError.value = err.message;
  }
}

async function onDeleteCredentials() {
  try {
    await pdp.deleteCredentials(config.value.einvoicePlatform.providerName);
  } catch (err) {
    credentialsError.value = err.message;
  }
}

async function onTestConnection() {
  await pdp.testConnection({
    providerName: config.value.einvoicePlatform.providerName,
    urlApi: config.value.einvoicePlatform.urlApi,
    isSandbox: config.value.einvoicePlatform.isSandbox,
  });
}

function openExternal(url) {
  window.electronAPI.openExternal(url);
}

async function checkForUpdates() {
  checkingUpdate.value = true;
  updateCheckMessage.value = "";
  updateCheckMessageClass.value = "";
  try {
    const result = await window.electronAPI.checkForUpdates();
    if (result?.devMode) {
      updateCheckMessage.value =
        "Vérification indisponible en mode développement.";
      updateCheckMessageClass.value = "error-message";
    } else if (!result?.ok) {
      updateCheckMessage.value =
        "Échec de la vérification" +
        (result?.message ? ` : ${result.message}` : ".");
      updateCheckMessageClass.value = "error-message";
    }
    // En cas de succès, la bannière en haut de l'app affiche le résultat
    // (recherche, mise à jour disponible, ou application à jour).
  } catch (error) {
    updateCheckMessage.value = "Échec de la vérification : " + error.message;
    updateCheckMessageClass.value = "error-message";
  } finally {
    checkingUpdate.value = false;
  }
}

async function uploadLogo() {
  uploadingLogo.value = true;
  try {
    const base64 = await window.electronAPI.uploadLogo();
    if (base64) {
      logoPreview.value = base64;
      globalLogo.value = base64;
    }
  } catch (error) {
    console.error("Failed to upload logo:", error);
    errors.value.general = "Erreur lors de l'upload du logo";
  } finally {
    uploadingLogo.value = false;
  }
}

async function removeLogo() {
  try {
    await window.electronAPI.deleteLogo();
    logoPreview.value = null;
    globalLogo.value = null;
  } catch (error) {
    console.error("Failed to delete logo:", error);
    errors.value.general = "Erreur lors de la suppression du logo";
  }
}

async function selectPdfFolder() {
  selectingFolder.value = true;
  try {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      config.value.billing.pdfOutputPath = folderPath;
    }
  } catch (error) {
    console.error("Failed to select folder:", error);
  } finally {
    selectingFolder.value = false;
  }
}

function validateForm() {
  errors.value = {};

  // Validation entreprise
  if (!config.value.company.companyName) {
    errors.value.companyName = "Nom de l'entreprise requis";
  }

  if (!config.value.company.companyId) {
    errors.value.companyId = "SIRET requis";
  } else if (
    !/^\d{14}$/.test(config.value.company.companyId.replace(/\s/g, ""))
  ) {
    errors.value.companyId = "SIRET invalide (14 chiffres requis)";
  }

  if (!config.value.company.address) {
    errors.value.address = "Adresse requise";
  }

  if (!config.value.company.postalCode) {
    errors.value.postalCode = "Code postal requis";
  } else if (!/^\d{5}$/.test(config.value.company.postalCode)) {
    errors.value.postalCode = "Code postal invalide (5 chiffres)";
  }

  if (!config.value.company.city) {
    errors.value.city = "Ville requise";
  }

  if (!config.value.company.email) {
    errors.value.email = "Email requis";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.value.company.email)) {
    errors.value.email = "Email invalide";
  }

  return Object.keys(errors.value).length === 0;
}

async function saveConfig() {
  if (!validateForm()) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  saving.value = true;
  successMessage.value = "";

  try {
    await window.electronAPI.saveConfig(toRaw(config.value));
    markAsSaved();
    successMessage.value = "Configuration sauvegardée avec succès !";

    setTimeout(() => {
      router.push("/");
    }, 1500);
  } catch (error) {
    console.error("Failed to save config:", error);
    errors.value.general = "Erreur lors de la sauvegarde: " + error.message;
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;
@use "@/styles/mixins" as *;

.settings {
  padding: $spacing-xl;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-lg;
}

.update-check {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: $spacing-xs;
  text-align: right;
}

.logo-upload__container {
  display: flex;
  align-items: center;
  gap: $spacing-lg;
  margin-top: $spacing-sm;
}

.logo-upload__preview {
  width: 80px;
  height: 80px;
  border-radius: $border-radius-md;
  border: 2px solid $grey-20;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $white;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
}

.logo-upload__placeholder {
  width: 80px;
  height: 80px;
  border-radius: $border-radius-md;
  border: 2px dashed $grey-30;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $grey-50;

  svg {
    width: 32px;
    height: 32px;
  }
}

.logo-upload__actions {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.btn-sm {
  padding: 6px 16px;
  font-size: $font-size-sm;
}

.path-input {
  display: flex;
  gap: $spacing-sm;
  align-items: center;

  input {
    flex: 1;
  }
}

.settings-form {
  margin-top: $spacing-sm;

  > .errors-list,
  > .success-message {
    margin-bottom: $spacing-lg;
  }

  > .form-actions {
    margin-top: $spacing-lg;
    border-top: none;
  }
}

.loading {
  @include flex-center;
  min-height: 400px;
  flex-direction: column;

  .loading-spinner {
    @include spinner;
  }
}

// ── PDP section ──────────────────────────────────────────────
.pdp-section {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.pdp-intro {
  color: $grey-80;
  margin: 0;

  a {
    color: $primary-color;
    text-decoration: underline;
  }
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: $spacing-sm;
  cursor: pointer;

  input[type="checkbox"] {
    width: auto;
    margin: 0;
  }
}

.form-group--inline {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.pdp-credentials {
  padding: $spacing-md;
  border: 1px solid $grey-20;
  border-radius: $border-radius-md;
  background: $grey-10;
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.pdp-credentials__status {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.pdp-credentials__hint {
  color: $grey-70;
  font-size: $font-size-sm;
  margin: 0;
}

.pdp-credentials__form {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.pdp-credentials__actions {
  display: flex;
  gap: $spacing-sm;
  flex-wrap: wrap;
}

.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: $border-radius-pill;
  font-size: $font-size-xs;
  font-weight: 500;
  line-height: 1.4;

  &.badge-success {
    background: rgba($success-color, 0.15);
    color: $success-color;
  }

  &.badge-warning {
    background: rgba($warning-color, 0.15);
    color: $warning-color;
  }

  &.badge-grey {
    background: $grey-20;
    color: $grey-80;
  }
}

.pdp-test {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.pdp-test__result {
  padding: $spacing-sm $spacing-md;
  border-radius: $border-radius-sm;
  font-size: $font-size-sm;
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  &--success {
    background: rgba($success-color, 0.1);
    color: $success-color;
    border: 1px solid rgba($success-color, 0.3);
  }

  &--error {
    background: rgba($error-color, 0.1);
    color: $error-color;
    border: 1px solid rgba($error-color, 0.3);
  }

  small {
    color: inherit;
    opacity: 0.85;
  }
}
</style>
