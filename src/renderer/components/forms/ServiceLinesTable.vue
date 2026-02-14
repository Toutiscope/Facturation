<template>
  <div class="services-table">
    <h3>Prestations</h3>

    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th style="width: 40%">Description</th>
            <th style="width: 10%">Quantité</th>
            <th style="width: 15%">Unité</th>
            <th style="width: 15%">P.U. HT</th>
            <th style="width: 15%">Total HT</th>
            <th style="width: 5%">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(service, index) in localServices" :key="service.id">
            <td>
              <input
                type="text"
                v-model="service.description"
                @input="updateService(index)"
                placeholder="Description de la prestation"
                class="form-control"
                required
              />
            </td>
            <td>
              <input
                type="number"
                v-model.number="service.quantity"
                @input="updateService(index)"
                min="0"
                step="0.01"
                class="form-control"
                required
              />
            </td>
            <td>
              <select
                v-model="service.unit"
                @change="updateService(index)"
                class="form-control"
              >
                <option value="heure">Heure</option>
                <option value="jour">Jour</option>
                <option value="pièce">Pièce</option>
                <option value="forfait">Forfait</option>
              </select>
            </td>
            <td>
              <input
                type="number"
                v-model.number="service.unitPriceHT"
                @input="updateService(index)"
                min="0"
                step="0.01"
                class="form-control"
                required
              />
            </td>
            <td class="total-cell">
              {{ formatCurrency(service.totalHT) }}
            </td>
            <td>
              <button
                type="button"
                @click="removeLine(index)"
                :disabled="localServices.length === 1"
                class="btn-icon btn-danger"
                title="Supprimer"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button type="button" @click="addLine" class="btn btn-secondary">
      + Ajouter une ligne
    </button>

    <div class="totals-section">
      <div class="totals-grid">
        <div class="total-row">
          <span class="total-label">Total HT :</span>
          <span class="total-value">{{ formatCurrency(totals.totalHT) }}</span>
        </div>
        <div class="total-row">
          <span class="total-label">TVA ({{ totals.VATRate }}%) :</span>
          <span class="total-value">{{ formatCurrency(totals.VAT) }}</span>
        </div>
        <div class="total-row total-ttc">
          <span class="total-label">Total TTC :</span>
          <span class="total-value">{{ formatCurrency(totals.totalTTC) }}</span>
        </div>
      </div>
      <p class="vat-notice">TVA non applicable, art. 293 B du CGI</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";

const props = defineProps({
  modelValue: {
    type: Array,
    required: true,
    default: () => [],
  },
});

const emit = defineEmits(["update:modelValue"]);

const localServices = ref([...props.modelValue]);

// Synchroniser les changements du parent
watch(
  () => props.modelValue,
  (newValue) => {
    localServices.value = [...newValue];
  },
  { deep: true },
);

// Calculer les totaux
const totals = computed(() => {
  const totalHT = localServices.value.reduce((sum, service) => {
    return sum + (service.totalHT || 0);
  }, 0);

  // Pour les micro-entrepreneurs, TVA = 0
  const VATRate = 0;
  const VAT = 0;
  const totalTTC = totalHT + VAT;

  return {
    totalHT: Math.round(totalHT * 100) / 100,
    VAT: Math.round(VAT * 100) / 100,
    VATRate,
    totalTTC: Math.round(totalTTC * 100) / 100,
  };
});

// Exposer les totaux pour le parent
defineExpose({ totals });

function updateService(index) {
  const service = localServices.value[index];

  // Calculer automatiquement le total HT
  const quantity = parseFloat(service.quantity) || 0;
  const unitPrice = parseFloat(service.unitPriceHT) || 0;
  service.totalHT = Math.round(quantity * unitPrice * 100) / 100;

  emitUpdate();
}

function addLine() {
  const newId =
    localServices.value.length > 0
      ? Math.max(...localServices.value.map((s) => s.id)) + 1
      : 1;

  localServices.value.push({
    id: newId,
    description: "",
    quantity: 1,
    unit: "heure",
    unitPriceHT: 0,
    totalHT: 0,
  });

  emitUpdate();
}

function removeLine(index) {
  if (localServices.value.length > 1) {
    localServices.value.splice(index, 1);
    emitUpdate();
  }
}

function emitUpdate() {
  emit("update:modelValue", [...localServices.value]);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

// Initialiser avec une ligne vide si nécessaire
if (localServices.value.length === 0) {
  addLine();
}
</script>

<style scoped lang="scss">
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.services-table {
  h3 {
    font-size: $font-size-lg;
    font-weight: 600;
    margin-bottom: $spacing-md;
    color: $grey-100;
  }

  .table-wrapper {
    overflow-x: auto;
    margin-bottom: $spacing-md;
  }

  .table {
    width: 100%;
    border-collapse: collapse;
    background: $white;
    border: 1px solid $grey-30;
    border-radius: $border-radius-md;

    thead {
      background-color: $primary-color;

      th {
        padding: $spacing-sm;
        text-align: left;
        color: $white;
        font-weight: 600;
        border-bottom: 2px solid $grey-30;
        font-size: $font-size-sm;
      }
    }

    tbody {
      tr {
        border-bottom: 1px solid $grey-30;

        &:last-child {
          border-bottom: none;
        }

        &:hover {
          background-color: $grey-30;
        }
      }

      td {
        padding: $spacing-xs;

        &.total-cell {
          font-weight: 600;
          text-align: right;
          padding-right: $spacing-sm;
        }
      }
    }
  }

  .totals-section {
    margin-top: $spacing-lg;
    padding: $spacing-md;
    margin-left: auto;
    border-radius: $border-radius-md;
    border: 1px solid $grey-60;
    max-width: 400px;
    margin-left: auto;

    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: $spacing-sm;
      font-size: $font-size-base;

      .total-label {
        font-weight: 500;
        color: $grey-80;
      }

      .total-value {
        font-weight: 600;
        color: $grey-100;
      }

      &.total-ttc {
        margin-top: $spacing-sm;
        padding-top: $spacing-sm;
        border-top: 2px solid $grey-30;
        font-size: $font-size-lg;

        .total-label,
        .total-value {
          color: $primary-color;
          font-weight: 700;
        }
      }
    }

    .vat-notice {
      margin-top: $spacing-sm;
      font-size: $font-size-sm;
      font-style: italic;
      color: $grey-80;
      text-align: right;
    }
  }
}
</style>
