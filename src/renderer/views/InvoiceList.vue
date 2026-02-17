<template>
  <div class="invoice-list-view">
    <div class="container">
      <div class="header">
        <h1>Factures</h1>
        <button @click="createNew" class="btn btn-primary">
          + Nouvelle facture
        </button>
      </div>

      <!-- Filtres -->
      <div class="filters pd-bottom-32">
        <div class="filter-row">
          <div class="filter-group">
            <label for="search">Rechercher</label>
            <input
              id="search"
              type="text"
              v-model="filters.search"
              @input="applyFilters"
              placeholder="Numéro ou nom du client"
              class="form-control"
            />
          </div>

          <div class="filter-group">
            <label for="status">Statut</label>
            <select
              id="status"
              v-model="filters.status"
              @change="applyFilters"
              class="form-control"
            >
              <option value="">Tous</option>
              <option value="draft">Brouillon</option>
              <option value="sent">Envoyé</option>
              <option value="paid">Payé</option>
              <option value="overdue">En retard</option>
            </select>
          </div>

          <div class="filter-group">
            <label for="year">Année</label>
            <select
              id="year"
              v-model="filters.year"
              @change="applyFilters"
              class="form-control"
            >
              <option :value="currentYear">{{ currentYear }}</option>
              <option :value="currentYear - 1">{{ currentYear - 1 }}</option>
              <option :value="currentYear - 2">{{ currentYear - 2 }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- États de chargement et erreurs -->
      <div v-if="loading" class="loading">Chargement...</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <!-- Tableau des factures -->
      <InvoiceTable
        v-else
        :invoices="documents"
        @edit="edit"
        @status-change="updateStatus"
        @delete="deleteInvoice"
      >
        <template #empty>
          <button @click="createNew" class="btn btn-secondary">
            Créer votre première facture
          </button>
        </template>
      </InvoiceTable>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useDocuments } from "@/composables/useDocuments";
import InvoiceTable from "@/components/tables/InvoiceTable.vue";

const router = useRouter();
const { documents, loading, error, loadAll, save, remove } =
  useDocuments("factures");

const currentYear = new Date().getFullYear();
const filters = ref({
  search: "",
  status: "",
  year: currentYear,
});

onMounted(async () => {
  await applyFilters();
});

async function applyFilters() {
  await loadAll({
    year: filters.value.year,
    status: filters.value.status || undefined,
    search: filters.value.search || undefined,
  });
}

function createNew() {
  router.push("/factures/nouvelle");
}

function edit(id) {
  router.push(`/factures/${id}`);
}

async function updateStatus(invoice, status) {
  try {
    const raw = JSON.parse(JSON.stringify(invoice));
    raw.status = status;
    await save(raw);
  } catch (err) {
    console.error("Failed to update invoice status:", err);
  }
}

async function deleteInvoice(id) {
  try {
    await remove(id);
  } catch (err) {
    console.error("Failed to delete invoice:", err);
  }
}
</script>

<style scoped lang="scss">
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;
@use "@/styles/mixins" as *;

.invoice-list-view {
  padding: $spacing-lg;

  .header {
    @include page-header;
  }

  .filters {
    .filter-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
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
</style>
