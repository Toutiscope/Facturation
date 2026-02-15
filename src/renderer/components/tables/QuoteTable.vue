<template>
  <div class="table-wrapper">
    <div v-if="quotes.length === 0" class="empty-state">
      <p>Aucun devis</p>
      <slot name="empty" />
    </div>

    <table v-else class="table">
      <thead>
        <tr>
          <th style="width: 90px">Numéro</th>
          <th style="width: 120px">Date</th>
          <th style="min-width: 200px">Client</th>
          <th v-if="showObjet" style="width: 50%">Objet</th>
          <th style="width: 60px">Montant TTC</th>
          <th style="width: 150px">Statut</th>
          <th style="width: 50px">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="quote in quotes"
          :key="quote.id"
          class="pointer"
          @click="$emit('edit', quote.id)"
        >
          <td class="numero">{{ quote.numero }}</td>
          <td>{{ quote.date }}</td>
          <td class="client-name">{{ quote.customer?.customerName }}</td>
          <td v-if="showObjet">{{ quote.object }}</td>
          <td class="amount">{{ formatCurrency(quote.totals?.totalTTC) }}</td>
          <td>
            <span :class="['status-badge', `status-${quote.status}`]">
              {{ quote.status }}
            </span>
          </td>
          <td class="actions-cell">
            <div class="dropdown" v-click-outside="() => closeMenu(quote.id)">
              <button
                class="btn-icon"
                title="Actions"
                @click.stop="toggleMenu(quote.id)"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="#244b63">
                  <circle cx="10" cy="4" r="2" />
                  <circle cx="10" cy="10" r="2" />
                  <circle cx="10" cy="16" r="2" />
                </svg>
              </button>
              <div v-if="openMenuId === quote.id" class="dropdown__menu">
                <button
                  v-if="quote.status !== 'envoyé'"
                  class="dropdown__item"
                  @click.stop="changeStatus(quote, 'envoyé')"
                >
                  Marquer comme envoyé
                </button>
                <button
                  v-if="quote.status !== 'accepté'"
                  class="dropdown__item"
                  @click.stop="changeStatus(quote, 'accepté')"
                >
                  Marquer comme accepté
                </button>
                <button
                  v-if="quote.status !== 'refusé'"
                  class="dropdown__item"
                  @click.stop="changeStatus(quote, 'refusé')"
                >
                  Marquer comme refusé
                </button>
                <button
                  v-if="quote.status !== 'brouillon'"
                  class="dropdown__item"
                  @click.stop="changeStatus(quote, 'brouillon')"
                >
                  Remettre en brouillon
                </button>
                <button
                  class="dropdown__item"
                  @click.stop="
                    $emit('convert', quote);
                    closeMenu(quote.id);
                  "
                >
                  Convertir en facture
                </button>
                <hr class="dropdown__separator" />
                <button
                  class="dropdown__item dropdown__item--danger"
                  @click.stop="confirmDelete(quote)"
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
    Êtes-vous sûr de vouloir supprimer le devis
    <strong>{{ quoteToDelete?.numero }}</strong> ?
  </ConfirmModal>
</template>

<script setup>
import { ref } from "vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";

defineProps({
  quotes: {
    type: Array,
    required: true,
  },
  showObjet: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["edit", "convert", "delete", "status-change"]);

const openMenuId = ref(null);
const showDeleteModal = ref(false);
const quoteToDelete = ref(null);

function toggleMenu(id) {
  openMenuId.value = openMenuId.value === id ? null : id;
}

function closeMenu(id) {
  if (openMenuId.value === id) {
    openMenuId.value = null;
  }
}

function changeStatus(quote, status) {
  emit("status-change", quote, status);
  openMenuId.value = null;
}

function confirmDelete(quote) {
  openMenuId.value = null;
  quoteToDelete.value = quote;
  showDeleteModal.value = true;
}

function cancelDelete() {
  quoteToDelete.value = null;
  showDeleteModal.value = false;
}

function doDelete() {
  if (!quoteToDelete.value) return;
  emit("delete", quoteToDelete.value.id);
  showDeleteModal.value = false;
  quoteToDelete.value = null;
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
