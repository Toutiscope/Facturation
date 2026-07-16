<template>
  <div v-if="visible" class="modal-overlay" @click="onClose">
    <div class="modal modal--wide" @click.stop>
      <h3>Envoyer la facture à la plateforme</h3>

      <!-- Chargement initial -->
      <div v-if="phase === 'loading'" class="pdp-send__loading">
        <div class="loading-spinner"></div>
        <p>Préparation…</p>
      </div>

      <!-- Revue avant envoi -->
      <template v-else-if="phase === 'review'">
        <p class="pdp-send__intro">
          La facture <strong>{{ document?.numero }}</strong> sera transmise via
          <strong>{{ providerName }}</strong>
          <template v-if="isSandbox"> (environnement bac à sable)</template>.
        </p>

        <div
          v-if="localValidation && !localValidation.valid"
          class="pdp-send__block pdp-send__block--error"
        >
          <strong>Mentions obligatoires manquantes :</strong>
          <ul>
            <li v-for="(err, i) in localValidation.errors" :key="i">
              <strong v-if="fieldLabel(err.path)"
                >{{ fieldLabel(err.path) }} : </strong
              >{{ err.message }}
            </li>
          </ul>
          <p class="pdp-send__hint">
            Corrigez la facture avant de pouvoir l'envoyer.
          </p>
        </div>

        <div v-else class="pdp-send__block pdp-send__block--ok">
          Les mentions obligatoires sont présentes. La plateforme effectuera une
          ultime validation à la réception.
        </div>
      </template>

      <!-- Envoi en cours -->
      <div v-else-if="phase === 'sending'" class="pdp-send__loading">
        <div class="loading-spinner"></div>
        <p>Transmission en cours…</p>
      </div>

      <!-- Succès -->
      <div
        v-else-if="phase === 'success'"
        class="pdp-send__block pdp-send__block--ok"
      >
        <strong>Facture transmise avec succès.</strong>
        <p v-if="depositNumber">
          Numéro de dépôt : <code>{{ depositNumber }}</code>
        </p>
        <p class="pdp-send__hint">
          Le suivi du cycle de vie (acceptation, paiement…) se fera via la
          synchronisation.
        </p>
      </div>

      <!-- Erreur -->
      <div
        v-else-if="phase === 'error'"
        class="pdp-send__block pdp-send__block--error"
      >
        <strong>Échec de la transmission</strong>
        <p>{{ errorInfo?.message }}</p>
        <p v-if="errorInfo?.details" class="pdp-send__details">
          {{ errorInfo.details }}
        </p>
        <p v-if="errorInfo?.status" class="pdp-send__hint">
          Code HTTP {{ errorInfo.status }}
          <template v-if="errorInfo.code"> ({{ errorInfo.code }})</template>
        </p>
      </div>

      <div class="modal-actions">
        <button
          v-if="phase === 'success'"
          class="btn btn-primary"
          @click="onClose"
        >
          Fermer
        </button>
        <template v-else-if="phase === 'error'">
          <button class="btn btn-secondary" @click="onClose">Fermer</button>
          <button class="btn btn-primary" @click="send">Réessayer</button>
        </template>
        <template v-else>
          <button
            class="btn btn-secondary"
            :disabled="phase === 'sending'"
            @click="onClose"
          >
            Annuler
          </button>
          <button
            class="btn btn-primary"
            :disabled="phase !== 'review' || !canSend"
            @click="send"
          >
            Envoyer à la plateforme
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, toRaw } from "vue";

const props = defineProps({
  visible: { type: Boolean, required: true },
  invoiceId: { type: String, default: "" },
  providerName: { type: String, default: "" },
  isSandbox: { type: Boolean, default: false },
});

const emit = defineEmits(["close", "sent"]);

const phase = ref("loading"); // loading | review | sending | success | error
const document = ref(null);
const localValidation = ref(null);
const depositNumber = ref(null);
const errorInfo = ref(null);

const canSend = computed(
  () => localValidation.value && localValidation.value.valid,
);

const FIELD_LABELS = {
  numero: "Numéro",
  date: "Date",
  dueDate: "Date d'échéance",
  status: "Statut",
  "customer.customerName": "Nom du client",
  "customer.companyName": "Raison sociale du client",
  "customer.companyId": "SIRET du client",
  "customer.address": "Adresse du client",
  "customer.postalCode": "Code postal du client",
  "customer.city": "Ville du client",
  "customer.email": "Email du client",
  "customer.clientType": "Type de client",
  services: "Prestations",
  "totals.totalHT": "Total HT",
  "totals.totalTTC": "Total TTC",
};

/**
 * Traduit un chemin Zod technique (ex. "customer.email", "services.0.description")
 * en libellé lisible. Les index de tableau sont normalisés (services.0 → services).
 */
function fieldLabel(path) {
  if (!path) return "";
  const normalized = path.replace(/\.\d+/g, "");
  return FIELD_LABELS[normalized] || normalized;
}

watch(
  () => props.visible,
  async (open) => {
    if (open) {
      await prepare();
    } else {
      reset();
    }
  },
);

function reset() {
  phase.value = "loading";
  document.value = null;
  localValidation.value = null;
  depositNumber.value = null;
  errorInfo.value = null;
}

async function prepare() {
  reset();
  try {
    document.value = await window.electronAPI.loadDocument(
      "factures",
      props.invoiceId,
    );
    localValidation.value = await window.electronAPI.validateDocument(
      "factures",
      toRaw(document.value),
    );
    phase.value = "review";
  } catch (err) {
    errorInfo.value = {
      message: err.message || "Impossible de charger la facture",
    };
    phase.value = "error";
  }
}

async function send() {
  phase.value = "sending";
  errorInfo.value = null;
  try {
    const result = await window.electronAPI.pdp.sendInvoice(props.invoiceId);
    if (!result.ok) {
      errorInfo.value = result.error;
      phase.value = "error";
      return;
    }
    depositNumber.value = result.data?.invoice?.einvoice?.depositNumber;
    phase.value = "success";
    emit("sent", result.data?.invoice);
  } catch (err) {
    errorInfo.value = { message: err.message || "Erreur inattendue" };
    phase.value = "error";
  }
}

function onClose() {
  if (phase.value === "sending") return;
  emit("close");
}
</script>

<style scoped lang="scss">
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;
@use "@/styles/mixins" as *;

.modal--wide {
  max-width: 560px;
  width: 90%;
}

.pdp-send__intro {
  margin-bottom: $spacing-md;
  color: $grey-90;
}

.pdp-send__loading {
  @include flex-center;
  flex-direction: column;
  gap: $spacing-sm;
  padding: $spacing-lg 0;

  .loading-spinner {
    @include spinner;
  }
}

.pdp-send__block {
  padding: $spacing-md;
  border-radius: $border-radius-sm;
  font-size: $font-size-sm;
  margin-bottom: $spacing-md;

  ul {
    margin: $spacing-sm 0 0;
    padding-left: $spacing-lg;
  }

  code {
    font-weight: 600;
  }

  &--ok {
    background: rgba($success-color, 0.1);
    color: $success-color;
    border: 1px solid rgba($success-color, 0.3);
  }

  &--error {
    background: rgba($error-color, 0.1);
    color: $error-color;
    border: 1px solid rgba($error-color, 0.3);
  }
}

.pdp-send__details {
  margin-top: $spacing-sm;
  font-family: monospace;
  font-size: $font-size-sm;
  white-space: pre-wrap;
  word-break: break-word;
}

.pdp-send__hint {
  margin-top: $spacing-sm;
  opacity: 0.85;
}
</style>
