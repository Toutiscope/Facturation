<template>
  <div class="table-wrapper">
    <div v-if="invoices.length === 0" class="empty-state">
      <p>Aucune facture</p>
      <slot name="empty" />
    </div>

    <table v-else class="table">
      <thead>
        <tr>
          <th style="width: 90px">Numéro</th>
          <th style="width: 120px">Date</th>
          <th style="min-width: 200px">Client</th>
          <th style="width: 50%">Objet</th>
          <th style="width: 60px">Montant TTC</th>
          <th style="width: 120px">Échéance</th>
          <th style="min-width: 150px; width: 150px">Statut</th>
          <th style="width: 50px">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="invoice in invoices"
          :key="invoice.id"
          class="pointer"
          @click="$emit('edit', invoice.id)"
        >
          <td class="numero">{{ invoice.numero }}</td>
          <td>{{ invoice.date }}</td>
          <td class="client-name">{{ invoice.customer?.customerName }}</td>
          <td>{{ invoice.object }}</td>
          <td class="amount">{{ formatCurrency(invoice.totals?.totalTTC) }}</td>
          <td>{{ invoice.dueDate }}</td>
          <td>
            <span :class="['status-badge', `status-${invoice.status}`]">
              {{ invoice.status }} {{ statusLabel(invoice.status) }}
            </span>
          </td>
          <td class="actions-cell">
            <div class="dropdown" v-click-outside="() => closeMenu(invoice.id)">
              <button
                class="btn-icon"
                title="Actions"
                @click.stop="toggleMenu(invoice.id)"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="#244b63">
                  <circle cx="10" cy="4" r="2" />
                  <circle cx="10" cy="10" r="2" />
                  <circle cx="10" cy="16" r="2" />
                </svg>
              </button>
              <div v-if="openMenuId === invoice.id" class="dropdown__menu">
                <button
                  v-if="invoice.status !== 'sent'"
                  class="dropdown__item"
                  @click.stop="changeStatus(invoice, 'sent')"
                >
                  Marquer comme envoyé
                </button>
                <button
                  v-if="invoice.status !== 'paid'"
                  class="dropdown__item"
                  @click.stop="changeStatus(invoice, 'paid')"
                >
                  Marquer comme payé
                </button>
                <button
                  v-if="invoice.status !== 'overdue'"
                  class="dropdown__item"
                  @click.stop="changeStatus(invoice, 'overdue')"
                >
                  Marquer en retard
                </button>
                <button
                  v-if="invoice.status !== 'draft'"
                  class="dropdown__item"
                  @click.stop="changeStatus(invoice, 'draft')"
                >
                  Remettre en brouillon
                </button>
                <button
                  class="dropdown__item"
                  @click.stop="handleGeneratePDF(invoice)"
                >
                  Générer PDF
                </button>
                <hr class="dropdown__separator" />
                <button
                  class="dropdown__item dropdown__item--danger"
                  @click.stop="confirmDelete(invoice)"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <ConfirmModal
    :visible="showDeleteModal"
    @cancel="cancelDelete"
    @confirm="doDelete"
  >
    Êtes-vous sûr de vouloir supprimer la facture
    <strong>{{ invoiceToDelete?.numero }}</strong> ?
  </ConfirmModal>
</template>

<script setup>
import { ref, toRaw } from "vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import { statusLabel } from "@/utils/statusLabels";

defineProps({
  invoices: {
    type: Array,
    required: true,
  },
  showObjet: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["edit", "delete", "status-change"]);

const openMenuId = ref(null);
const showDeleteModal = ref(false);
const invoiceToDelete = ref(null);

function toggleMenu(id) {
  openMenuId.value = openMenuId.value === id ? null : id;
}

function closeMenu(id) {
  if (openMenuId.value === id) {
    openMenuId.value = null;
  }
}

function changeStatus(invoice, status) {
  emit("status-change", invoice, status);
  openMenuId.value = null;
}

async function handleGeneratePDF(invoice) {
  openMenuId.value = null;
  try {
    const raw = JSON.parse(JSON.stringify(toRaw(invoice)));
    const filePath = await window.electronAPI.generatePDF("factures", raw);
    if (filePath) {
      alert(`PDF généré avec succès !\nEmplacement : ${filePath}`);
    }
  } catch (err) {
    alert(`Erreur lors de la génération du PDF : ${err.message}`);
  }
}

function confirmDelete(invoice) {
  openMenuId.value = null;
  invoiceToDelete.value = invoice;
  showDeleteModal.value = true;
}

function cancelDelete() {
  invoiceToDelete.value = null;
  showDeleteModal.value = false;
}

function doDelete() {
  if (!invoiceToDelete.value) return;
  emit("delete", invoiceToDelete.value.id);
  showDeleteModal.value = false;
  invoiceToDelete.value = null;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

// Custom directive for click outside
const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (event) => {
      if (!el.contains(event.target)) {
        binding.value();
      }
    };
    document.addEventListener("click", el._clickOutside);
  },
  unmounted(el) {
    document.removeEventListener("click", el._clickOutside);
  },
};
</script>

<style scoped lang="scss">
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.dropdown {
  position: relative;
}

.dropdown__menu {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 10;
  min-width: 220px;
  background: $white;
  border: 1px solid $grey-20;
  border-radius: $border-radius-md;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  padding: 4px 0;
}

.dropdown__item {
  display: block;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: none;
  text-align: left;
  font-size: $font-size-sm;
  color: $grey-90;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background-color: $grey-10;
  }

  &--danger {
    color: $error-color;

    &:hover {
      background-color: rgba($error-color, 0.06);
    }
  }
}

.dropdown__separator {
  margin: 4px 0;
  border: none;
  border-top: 1px solid $grey-20;
}
</style>
