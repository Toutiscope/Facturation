<template>
  <MainLayout class="settings">
    <header>
      <h1>Configuration</h1>
    </header>

    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>Chargement de la configuration...</p>
    </div>

    <form v-else @submit.prevent="saveConfig" class="settings-form card">
      <!-- Erreur générale -->
      <div v-if="errors.general" class="errors-list">
        <h3>Erreur</h3>
        <p>{{ errors.general }}</p>
      </div>

      <!-- Message de succès -->
      <div v-if="successMessage" class="success-message">
        ✓ {{ successMessage }}
      </div>

      <!-- Section Entreprise -->
      <section class="form-section">
        <h2>Informations de mon entreprise</h2>

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
            maxlength="17"
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

        <div class="form-row">
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

        <div class="form-row">
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
              placeholder="02 XX XX XX XX"
            />
          </div>
        </div>

        <div class="form-group">
          <label>Site web (optionnel)</label>
          <input
            v-model="config.company.webSite"
            type="text"
            placeholder="https://www.exemple.fr"
          />
        </div>
      </section>

      <!-- Section RIB -->
      <section class="form-section">
        <h2>Coordonnées bancaires (optionnel)</h2>

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

        <div class="form-row">
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
        </div>
      </section>

      <!-- Section Chorus Pro -->
      <section class="form-section">
        <h2>Chorus Pro (optionnel - Phase 4)</h2>
        <p style="color: #64748b; margin-bottom: 1rem;">
          Configuration pour l'envoi de factures électroniques à l'administration.
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

      <!-- Section Facturation -->
      <section class="form-section">
        <h2>Paramètres de facturation</h2>

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

        <div class="form-row">
          <div class="form-group">
            <label>Dernier numéro de devis</label>
            <input
              v-model.number="config.billing.latestQuoteNumber"
              type="number"
              min="0"
            />
            <small>Numérotation automatique à partir de ce numéro</small>
          </div>

          <div class="form-group">
            <label>Dernier numéro de facture</label>
            <input
              v-model.number="config.billing.latestInvoiceNumber"
              type="number"
              min="0"
            />
            <small>Numérotation automatique à partir de ce numéro</small>
          </div>
        </div>
      </section>

      <!-- Actions -->
      <div class="form-actions">
        <button type="button" @click="router.push('/')" class="btn btn-secondary">
          Annuler
        </button>
        <button type="submit" :disabled="saving" class="btn btn-primary">
          {{ saving ? 'Sauvegarde en cours...' : 'Sauvegarder la configuration' }}
        </button>
      </div>
    </form>
  </MainLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import MainLayout from '@/components/layout/MainLayout.vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(true)
const saving = ref(false)
const config = ref(null)
const errors = ref({})
const successMessage = ref('')

onMounted(async () => {
  try {
    config.value = await window.electronAPI.loadConfig()
  } catch (error) {
    console.error('Failed to load config:', error)
    errors.value.general = 'Impossible de charger la configuration'
  } finally {
    loading.value = false
  }
})

function validateForm() {
  errors.value = {}

  // Validation entreprise
  if (!config.value.company.companyName) {
    errors.value.companyName = 'Nom de l\'entreprise requis'
  }

  if (!config.value.company.companyId) {
    errors.value.companyId = 'SIRET requis'
  } else if (!/^\d{14}$/.test(config.value.company.companyId.replace(/\s/g, ''))) {
    errors.value.companyId = 'SIRET invalide (14 chiffres requis)'
  }

  if (!config.value.company.address) {
    errors.value.address = 'Adresse requise'
  }

  if (!config.value.company.postalCode) {
    errors.value.postalCode = 'Code postal requis'
  } else if (!/^\d{5}$/.test(config.value.company.postalCode)) {
    errors.value.postalCode = 'Code postal invalide (5 chiffres)'
  }

  if (!config.value.company.city) {
    errors.value.city = 'Ville requise'
  }

  if (!config.value.company.email) {
    errors.value.email = 'Email requis'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.value.company.email)) {
    errors.value.email = 'Email invalide'
  }

  return Object.keys(errors.value).length === 0
}

async function saveConfig() {
  // if (!validateForm()) {
  //   window.scrollTo({ top: 0, behavior: 'smooth' })
  //   return
  // }

  saving.value = true
  successMessage.value = ''

  try {
    await window.electronAPI.saveConfig(config.value)
    successMessage.value = 'Configuration sauvegardée avec succès !'

    setTimeout(() => {
      router.push('/')
    }, 1500)
  } catch (error) {
    console.error('Failed to save config:', error)
    errors.value.general = 'Erreur lors de la sauvegarde: ' + error.message
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/mixins' as *;
@use '@/styles/variables' as *;
@use '@/styles/mixins' as *;

.settings {
  padding: $spacing-xl;
  max-width: 1000px;
  margin: 0 auto;
}

.settings-form {
  margin-top: $spacing-xl;
}

.loading {
  @include flex-center;
  min-height: 400px;
  flex-direction: column;

  .loading-spinner {
    width: 50px;
    height: 50px;
    border: 4px solid $border-color;
    border-top-color: $primary-color;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: $spacing-md;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
}
</style>
