<template>
  <div class="settings">
    <header>
      <h1>Mes paramètres</h1>
    </header>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>Chargement de la configuration...</p>
    </div>

    <form v-else @submit.prevent="saveConfig" class="settings-form">
      <!-- Erreur générale -->
      <div v-if="errors.general" class="errors-list">
        <h3>Erreur</h3>
        <p>{{ errors.general }}</p>
      </div>

      <!-- Message de succès -->
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>

      <div class="settings-grid grid grid--cols-3 gap-16 grid-start">
        <!-- Section Entreprise -->
        <section class="card settings-card">
          <h2>Entreprise</h2>

          <!-- Logo upload -->
          <div class="form-group logo-upload">
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
                  @click="uploadLogo"
                >
                  {{ logoPreview ? "Changer" : "Choisir un logo" }}
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
            <label>Adresse *</label>
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
        </section>

        <!-- Section RIB -->
        <div>
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

            <div class="form-group">
              <label>Banque</label>
              <input
                v-model="config.rib.bank"
                type="text"
                placeholder="Nom de la banque"
              />
            </div>
          </section>

          <!-- Section Chorus Pro -->
          <section class="card mg-top-16 settings-card">
            <h2>Chorus Pro</h2>
            <p class="section-hint">
              Configuration pour l'envoi de factures électroniques à
              l'administration.
            </p>

            <div class="form-group">
              <label>Identifiant Chorus Pro</label>
              <input
                v-model="config.chorusPro.identifier"
                type="text"
                placeholder="Identifiant"
              />
            </div>

            <div class="form-group">
              <label>Mot de passe</label>
              <input
                v-model="config.chorusPro.password"
                type="password"
                placeholder="Mot de passe"
              />
            </div>

            <div class="form-group">
              <label>API Key</label>
              <input
                v-model="config.chorusPro.apiKey"
                type="text"
                placeholder="Clé API"
              />
            </div>

            <div class="form-group">
              <label>URL API</label>
              <input
                v-model="config.chorusPro.urlApi"
                type="text"
                placeholder="https://chorus-pro.gouv.fr/api/"
              />
            </div>
          </section>
        </div>

        <!-- Section Facturation -->
        <section class="card settings-card">
          <h2>Facturation</h2>

          <div class="form-group">
            <label>Mention légale</label>
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
            <label>Pénalités de retard</label>
            <textarea
              v-model="config.billing.latePenalties"
              rows="2"
              placeholder="En cas de retard de paiement..."
            ></textarea>
          </div>

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
        </section>
      </div>

      <!-- Actions -->
      <div class="form-actions">
        <button
          type="button"
          @click="router.push('/')"
          class="btn btn-secondary"
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
import { useRouter } from "vue-router";

const router = useRouter();
const globalLogo = inject("logo");

const loading = ref(true);
const saving = ref(false);
const config = ref(null);
const errors = ref({});
const successMessage = ref("");
const logoPreview = ref(null);

onMounted(async () => {
  try {
    config.value = await window.electronAPI.loadConfig();
    logoPreview.value = await window.electronAPI.getLogo();
  } catch (error) {
    console.error("Failed to load config:", error);
    errors.value.general = "Impossible de charger la configuration";
  } finally {
    loading.value = false;
  }
});

async function uploadLogo() {
  try {
    const base64 = await window.electronAPI.uploadLogo();
    if (base64) {
      logoPreview.value = base64;
      globalLogo.value = base64;
    }
  } catch (error) {
    console.error("Failed to upload logo:", error);
    errors.value.general = "Erreur lors de l'upload du logo";
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

.logo-upload {
  margin-bottom: $spacing-lg;
  padding-bottom: $spacing-lg;
  border-bottom: 1px solid $grey-20;
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
</style>
