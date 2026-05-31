<template>
  <div class="txn-table">
    <header class="txn-table__head">
      <div>Date</div>
      <div>Libellé</div>
      <div>Catégorie</div>
      <div>Source</div>
      <div class="txn-table__amount-col">Montant</div>
      <div></div>
    </header>

    <div v-if="rows.length === 0" class="txn-table__empty">
      Aucune transaction sur la période sélectionnée.
    </div>

    <div
      v-for="row in rows"
      :key="row.id"
      class="txn-table__row"
      :class="{
        'txn-table__row--clickable': row.source === 'facture',
      }"
      @click="onRowClick(row)"
    >
      <div class="txn-table__date">{{ formatDate(row.date) }}</div>
      <div class="txn-table__label">{{ row.label }}</div>
      <div>
        <span v-if="row.category" class="category-tag">{{ row.category }}</span>
      </div>
      <div>
        <span
          class="source-badge"
          :class="
            row.source === 'facture'
              ? 'source-badge--invoice'
              : 'source-badge--manual'
          "
        >
          {{ row.source === "facture" ? "Facture" : "Manuel" }}
        </span>
      </div>
      <div class="txn-table__amount">
        <span
          :class="
            row.signedAmount >= 0
              ? 'amount amount--positive'
              : 'amount amount--negative'
          "
        >
          {{ row.signedAmount >= 0 ? "+" : "−" }} {{ formatAmount(row.amount) }} €
        </span>
      </div>
      <div class="txn-table__actions">
        <div
          v-if="row.source === 'manuel'"
          class="kebab"
          v-click-outside="() => closeMenu(row.id)"
        >
          <button
            type="button"
            class="kebab__trigger"
            :class="{ 'kebab__trigger--active': openMenuId === row.id }"
            aria-label="Actions"
            @click.stop="toggleMenu(row.id, $event)"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <circle cx="10" cy="4" r="1.8" />
              <circle cx="10" cy="10" r="1.8" />
              <circle cx="10" cy="16" r="1.8" />
            </svg>
          </button>
          <div
            v-if="openMenuId === row.id"
            class="kebab__menu"
            :class="{ 'kebab__menu--up': menuPlacement === 'up' }"
          >
            <div class="kebab__menu-header">Transaction manuelle</div>
            <button
              type="button"
              class="kebab__item"
              @click.stop="onAction('edit', row)"
            >
              Modifier
            </button>
            <button
              type="button"
              class="kebab__item"
              @click.stop="onAction('duplicate', row)"
            >
              Dupliquer
            </button>
            <button
              type="button"
              class="kebab__item"
              @click.stop="onAction('change-category', row)"
            >
              Changer la catégorie
            </button>
            <hr class="kebab__separator" />
            <button
              type="button"
              class="kebab__item kebab__item--danger"
              @click.stop="onAction('delete', row)"
            >
              Supprimer
            </button>
          </div>
        </div>
        <span v-else class="txn-table__open-marker" title="Ouvrir la facture">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from "vue";

defineProps({
  rows: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits([
  "edit",
  "duplicate",
  "change-category",
  "delete",
  "open-invoice",
]);

function onRowClick(row) {
  if (row.source === "facture" && row.invoiceId) {
    emit("open-invoice", row.invoiceId);
  }
}

const openMenuId = ref(null);
const menuPlacement = ref("down");

// Hauteur approximative du menu (header + 4 items + séparateur + paddings)
const ESTIMATED_MENU_HEIGHT = 230;

async function toggleMenu(id, event) {
  if (openMenuId.value === id) {
    openMenuId.value = null;
    return;
  }
  // Place le menu vers le haut s'il y a peu d'espace sous le bouton
  if (event?.currentTarget?.getBoundingClientRect) {
    const rect = event.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    menuPlacement.value =
      spaceBelow < ESTIMATED_MENU_HEIGHT && spaceAbove > spaceBelow
        ? "up"
        : "down";
  } else {
    menuPlacement.value = "down";
  }
  openMenuId.value = id;
  await nextTick();
}

function closeMenu(id) {
  if (openMenuId.value === id) openMenuId.value = null;
}

function onAction(action, row) {
  openMenuId.value = null;
  emit(action, row);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  // Format "DD/MM/YYYY" -> "DD mois"
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return dateStr;
  const months = [
    "janv.",
    "févr.",
    "mars",
    "avr.",
    "mai",
    "juin",
    "juil.",
    "août",
    "sept.",
    "oct.",
    "nov.",
    "déc.",
  ];
  const day = parseInt(m[1], 10);
  const month = months[parseInt(m[2], 10) - 1] || m[2];
  return `${day} ${month}`;
}

function formatAmount(v) {
  return Math.abs(v).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (event) => {
      if (!el.contains(event.target)) binding.value();
    };
    document.addEventListener("click", el._clickOutside);
  },
  unmounted(el) {
    document.removeEventListener("click", el._clickOutside);
  },
};
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

$grid-cols: 90px 1fr 140px 120px 140px 60px;

.txn-table__head {
  display: grid;
  grid-template-columns: $grid-cols;
  padding: $spacing-sm $spacing-md;
  color: $grey-60;
  font-size: $font-size-xs;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid $grey-20;
}

.txn-table__row {
  display: grid;
  grid-template-columns: $grid-cols;
  padding: $spacing-sm $spacing-md;
  align-items: center;
  font-size: $font-size-sm;
  border-bottom: 1px solid $grey-10;
  color: $grey-90;
  transition: background 0.15s ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: $grey-10;
  }

  &--clickable {
    cursor: pointer;

    &:hover .txn-table__open-marker {
      color: $primary-color;
    }
  }
}

.txn-table__empty {
  padding: $spacing-xl;
  text-align: center;
  color: $grey-60;
  font-size: $font-size-sm;
}

.txn-table__date {
  color: $grey-70;
  font-size: $font-size-xs;
}

.txn-table__label {
  color: $grey-100;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.txn-table__amount-col {
  text-align: right;
}

.txn-table__amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.txn-table__actions {
  text-align: right;
  position: relative;
}

.txn-table__open-marker {
  display: inline-grid;
  place-items: center;
  color: $grey-40;
  transition: color 0.15s ease;
}

.amount {
  font-weight: 600;

  &--positive {
    color: $success-color;
  }

  &--negative {
    color: $error-color;
  }
}

.category-tag {
  display: inline-block;
  padding: 3px 9px;
  background: $grey-10;
  color: $grey-90;
  font-size: $font-size-xs;
  border-radius: $border-radius-pill;
}

.source-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: $border-radius-sm;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;

  &--invoice {
    background: rgba($primary-color, 0.1);
    color: $primary-color;
  }

  &--manual {
    background: $grey-10;
    color: $grey-70;
  }
}

.source-badge__lock {
  font-size: 9px;
}

.kebab {
  position: relative;
  display: inline-block;
}

.kebab__trigger {
  background: none;
  border: none;
  padding: 6px;
  color: $grey-70;
  cursor: pointer;
  border-radius: $border-radius-sm;
  display: inline-grid;
  place-items: center;

  &:hover {
    background: $grey-20;
    color: $grey-100;
  }

  &--active {
    background: rgba($primary-color, 0.08);
    color: $primary-color;
    box-shadow: 0 0 0 4px rgba($primary-color, 0.12);
  }
}

.kebab__menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  width: 240px;
  background: $white;
  border: 1px solid $grey-20;
  border-radius: $border-radius-md;
  box-shadow:
    0 18px 40px -12px rgba($grey-100, 0.25),
    0 4px 12px -4px rgba($grey-100, 0.12);
  padding: 6px;
  z-index: 20;
  text-align: left;

  &--up {
    top: auto;
    bottom: 100%;
    margin-top: 0;
    margin-bottom: 4px;
    box-shadow:
      0 -18px 40px -12px rgba($grey-100, 0.25),
      0 -4px 12px -4px rgba($grey-100, 0.12);
  }
}

.kebab__menu-header {
  padding: 8px 12px 6px;
  font-size: 11px;
  color: $grey-60;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.kebab__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 8px 10px;
  background: none;
  border: none;
  border-radius: $border-radius-sm;
  font-size: $font-size-sm;
  font-weight: 500;
  color: $grey-90;
  cursor: pointer;
  text-align: left;
  font-family: inherit;

  &:hover {
    background: $grey-10;
  }

  &--danger {
    color: $error-color;

    &:hover {
      background: rgba($error-color, 0.06);
    }
  }
}

.kebab__separator {
  border: none;
  border-top: 1px solid $grey-10;
  margin: 4px 6px;
}
</style>
