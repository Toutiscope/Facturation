<template>
  <div v-if="visible" class="modal-overlay" @click="$emit('cancel')">
    <div class="modal" @click.stop>
      <h3>Marquer la facture comme payée</h3>
      <p>
        Indiquez la date à laquelle la facture
        <strong v-if="numero">{{ numero }}</strong> a été encaissée. Le chiffre
        d'affaires sera comptabilisé sur ce mois.
      </p>

      <div class="form-group">
        <label class="required" for="payment-date">Payé le</label>
        <input
          id="payment-date"
          v-model="dateValue"
          class="form-control"
          type="date"
        />
      </div>

      <p v-if="beforeEmission" class="warning">
        La date de paiement ne peut pas être antérieure à la date d'émission ({{
          emissionDate
        }}).
      </p>
      <p v-else-if="inFuture" class="hint">
        Cette date est dans le futur : assurez-vous que c'est bien voulu.
      </p>

      <div class="modal-actions">
        <button class="btn btn-secondary" @click="$emit('cancel')">
          Annuler
        </button>
        <button
          class="btn btn-primary"
          :disabled="!dateValue || beforeEmission"
          @click="confirm"
        >
          Valider le paiement
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";

const props = defineProps({
  visible: { type: Boolean, required: true },
  numero: { type: String, default: "" },
  // Date d'émission au format FR "DD/MM/YYYY", sert de garde-fou.
  emissionDate: { type: String, default: "" },
});

const emit = defineEmits(["cancel", "confirm"]);

const dateValue = ref("");

// (Ré)initialise à aujourd'hui à chaque ouverture.
watch(
  () => props.visible,
  (open) => {
    if (open) {
      dateValue.value = new Date().toISOString().split("T")[0];
    }
  },
);

function frToIso(fr) {
  if (!fr || !fr.includes("/")) return "";
  const [day, month, year] = fr.split("/");
  return `${year}-${month}-${day}`;
}

function isoToFr(iso) {
  if (!iso || !iso.includes("-")) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

const emissionIso = computed(() => frToIso(props.emissionDate));

// Les chaînes ISO yyyy-mm-dd se comparent lexicographiquement.
const beforeEmission = computed(
  () =>
    Boolean(dateValue.value) &&
    Boolean(emissionIso.value) &&
    dateValue.value < emissionIso.value,
);

const inFuture = computed(() => {
  if (!dateValue.value) return false;
  const today = new Date().toISOString().split("T")[0];
  return dateValue.value > today;
});

function confirm() {
  if (!dateValue.value || beforeEmission.value) return;
  emit("confirm", isoToFr(dateValue.value));
}
</script>

<style scoped lang="scss">
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.hint {
  color: $warning-color;
  font-weight: 500;
}
</style>
