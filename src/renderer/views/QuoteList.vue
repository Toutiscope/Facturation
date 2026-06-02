<template>
  <div class="quote-list-view">
    <div class="container">
      <div class="header">
        <h1>Devis</h1>
        <button class="btn btn-primary" @click="createNew">
          + Nouveau devis
        </button>
      </div>

      <!-- Filtres -->
      <div class="filters pd-bottom-32">
        <div class="filter-row">
          <div class="filter-group">
            <label for="search">Rechercher</label>
            <input
              id="search"
              v-model="filters.search"
              type="text"
              placeholder="Numéro ou nom du client"
              class="form-control"
              @input="applyFilters"
            />
          </div>

          <div class="filter-group">
            <label for="status">Statut</label>
            <select
              id="status"
              v-model="filters.status"
              class="form-control"
              @change="applyFilters"
            >
              <option value="">Tous</option>
              <option value="draft">Brouillon</option>
              <option value="sent">Envoyé</option>
              <option value="accepted">Accepté</option>
              <option value="refused">Refusé</option>
            </select>
          </div>

          <div class="filter-group">
            <label>Période</label>
            <div class="segmented" role="tablist">
              <button
                v-for="opt in periodOptions"
                :key="opt"
                :aria-selected="period === opt"
                :class="{ 'segmented__item--active': period === opt }"
                class="segmented__item"
                role="tab"
                type="button"
                @click="setPeriod(opt)"
              >
                {{ opt }}
              </button>
            </div>
          </div>

          <div class="filter-group">
            <label for="month">Mois</label>
            <input
              id="month"
              v-model="filters.month"
              type="month"
              class="form-control"
              :disabled="period !== 'Mois'"
              :title="
                period === 'Mois'
                  ? 'Choisir le mois affiché'
                  : 'Disponible en vue Mois'
              "
              @change="applyFilters"
              @click="openMonthPicker"
            />
          </div>
        </div>
      </div>

      <!-- États de chargement et erreurs -->
      <div v-if="loading" class="loading">Chargement...</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <!-- Tableau des devis -->
      <QuoteTable
        v-else
        :quotes="documents"
        @edit="edit"
        @convert="convertToInvoice"
        @status-change="updateStatus"
        @delete="deleteQuote"
      >
        <template #empty>
          <button
            v-if="period === 'Mois'"
            class="btn btn-secondary"
            @click="viewCurrentYear"
          >
            Voir les devis de l'année en cours
          </button>
          <button v-else class="btn btn-secondary" @click="createNew">
            Créez votre premier devis
          </button>
        </template>
      </QuoteTable>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useDocuments } from "@/composables/useDocuments";
import QuoteTable from "@/components/tables/QuoteTable.vue";

const router = useRouter();
const { documents, loading, error, loadAll, save, remove } =
  useDocuments("devis");

// Mois courant au format "YYYY-MM" pour l'input type="month".
function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Sélecteur de période, identique aux pages Finances et Factures : la vue
// "Mois" filtre sur le mois choisi, la vue "Année" sur l'année entière
// (l'input mois est alors désactivé mais sa valeur sert à déterminer l'année).
const periodOptions = ["Mois", "Année"];
const period = ref("Mois");
const filters = ref({
  search: "",
  status: "",
  month: currentMonthValue(),
});

function setPeriod(opt) {
  period.value = opt;
  applyFilters();
}

// Depuis l'état vide d'une vue mensuelle : revenir à l'année en cours.
function viewCurrentYear() {
  filters.value.month = currentMonthValue();
  setPeriod("Année");
}

onMounted(async () => {
  await applyFilters();
});

// Ouvre le calendrier natif au clic n'importe où sur l'input (pas seulement
// sur l'icône). showPicker() peut ne pas exister sur tous les moteurs.
function openMonthPicker(e) {
  const el = e.currentTarget;
  if (typeof el.showPicker === "function") {
    try {
      el.showPicker();
    } catch {
      // showPicker peut lever hors d'un geste utilisateur — sans gravité.
    }
  }
}

async function applyFilters() {
  // filters.month est au format "YYYY-MM" (ou vide si l'utilisateur l'efface).
  const [year, month] = (filters.value.month || "").split("-");
  await loadAll({
    year: year ? Number(year) : new Date().getFullYear(),
    // En vue "Année" on ignore le mois pour charger l'année complète.
    month: period.value === "Mois" && month ? Number(month) : undefined,
    status: filters.value.status || undefined,
    search: filters.value.search || undefined,
  });
}

function createNew() {
  router.push("/devis/nouveau");
}

function edit(id) {
  router.push(`/devis/${id}`);
}

function convertToInvoice(quote) {
  // Stocker le devis dans sessionStorage pour pré-remplir la facture
  sessionStorage.setItem("quoteToConvert", JSON.stringify(quote));
  router.push("/factures/nouvelle");
}

async function updateStatus(quote, status) {
  try {
    const raw = JSON.parse(JSON.stringify(quote));
    raw.status = status;
    await save(raw);
  } catch (err) {
    console.error("Failed to update quote status:", err);
  }
}

async function deleteQuote(id) {
  try {
    await remove(id);
  } catch (err) {
    console.error("Failed to delete quote:", err);
  }
}
</script>

<style scoped lang="scss">
@use "sass:math";
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;
@use "@/styles/mixins" as *;

.quote-list-view {
  padding: $spacing-lg;

  .header {
    @include page-header;
  }

  .filters {
    .filter-row {
      display: grid;
      grid-template-columns: 2fr 1fr auto 1fr;
      gap: $spacing-md;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .filter-group {
      label {
        font-size: $font-size-sm;
      }
    }
  }
}

// Sélecteur de période — identique à la page Finances.
.segmented {
  align-self: start;
  background: $white;
  border: 1px solid $grey-20;
  border-radius: $border-radius-md;
  display: inline-flex;
  padding: math.div($spacing-xs, 2);
}

.segmented__item {
  background: transparent;
  border: none;
  border-radius: $border-radius-sm;
  color: $grey-90;
  cursor: pointer;
  font: inherit;
  font-size: $font-size-sm;
  font-weight: 500;
  padding: $spacing-xs $spacing-md;
  transition: $transition-base;

  &:hover {
    color: $grey-100;
  }

  &--active,
  &--active:hover {
    background: $grey-100;
    color: $white;
  }
}
</style>
