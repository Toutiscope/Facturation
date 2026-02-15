<template>
  <div class="quote-list-view">
    <div class="container">
      <div class="header">
        <h1>Devis</h1>
        <button @click="createNew" class="btn btn-primary">
          + Nouveau devis
        </button>
      </div>

      <!-- Filtres -->
      <div class="filters card">
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
              <option value="brouillon">Brouillon</option>
              <option value="envoyé">Envoyé</option>
              <option value="accepté">Accepté</option>
              <option value="refusé">Refusé</option>
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

      <!-- Tableau des devis -->
      <div v-else class="table-wrapper card">
        <div v-if="documents.length === 0" class="empty-state">
          <p>Aucun devis trouvé</p>
          <button @click="createNew" class="btn btn-secondary">
            Créer votre premier devis
          </button>
        </div>

        <table v-else class="table">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Date</th>
              <th>Client</th>
              <th>Montant TTC</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="quote in documents"
              :key="quote.id"
              class="pointer"
              @click="edit(quote.id)"
            >
              <td class="numero">{{ quote.numero }}</td>
              <td>{{ quote.date }}</td>
              <td class="client-name">{{ quote.customer.customerName }}</td>
              <td class="amount">
                {{ formatCurrency(quote.totals.totalTTC) }}
              </td>
              <td>
                <span :class="['status-badge', `status-${quote.status}`]">
                  {{ quote.status }}
                </span>
              </td>
              <td class="actions-cell">
                <div class="flex flex-vertical-center flex-space-between gap-4">
                  <button
                    @click="convertToInvoice(quote)"
                    class="btn btn-primary btn-sm"
                  >
                    Convertir en facture
                  </button>
                  <button
                    @click="confirmDelete(quote)"
                    class="btn-icon btn-danger"
                    title="Supprimer"
                  >
                    <svg
                      height="24"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 640 640"
                    >
                      <path
                        fill="#244b63"
                        d="M262.2 48c-13.3 0-25.3 8.3-30 20.8L216 112h-96c-13.3 0-24 10.7-24 24s10.7 24 24 24h400c13.3 0 24-10.7 24-24s-10.7-24-24-24h-96l-16.2-43.2c-4.7-12.5-16.6-20.8-30-20.8H262.2zM128 208v304c0 35.3 28.7 64 64 64h256c35.3 0 64-28.7 64-64V208h-48v304c0 8.8-7.2 16-16 16H192c-8.8 0-16-7.2-16-16V208h-48zm160 72c0-13.3-10.7-24-24-24s-24 10.7-24 24v176c0 13.3 10.7 24 24 24s24-10.7 24-24V280zm112 0c0-13.3-10.7-24-24-24s-24 10.7-24 24v176c0 13.3 10.7 24 24 24s24-10.7 24-24V280z"
                      />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ConfirmModal
      :visible="showDeleteModal"
      @cancel="cancelDelete"
      @confirm="deleteQuote"
    >
      Êtes-vous sûr de vouloir supprimer le devis
      <strong>{{ quoteToDelete?.numero }}</strong> ?
    </ConfirmModal>
  </div>
</template>

<script setup>
import { ref, onMounted, toRaw } from "vue";
import { useRouter } from "vue-router";
import { useDocuments } from "@/composables/useDocuments";
import ConfirmModal from "@/components/common/ConfirmModal.vue";

const router = useRouter();
const { documents, loading, error, loadAll, remove } = useDocuments("devis");

const currentYear = new Date().getFullYear();
const filters = ref({
  search: "",
  status: "",
  year: currentYear,
});

const showDeleteModal = ref(false);
const quoteToDelete = ref(null);

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

function confirmDelete(quote) {
  quoteToDelete.value = quote;
  showDeleteModal.value = true;
}

function cancelDelete() {
  quoteToDelete.value = null;
  showDeleteModal.value = false;
}

async function deleteQuote() {
  if (!quoteToDelete.value) return;

  try {
    await remove(quoteToDelete.value.id);
    showDeleteModal.value = false;
    quoteToDelete.value = null;
  } catch (err) {
    console.error("Failed to delete quote:", err);
  }
}

async function generatePDF(quote) {
  try {
    const raw = JSON.parse(JSON.stringify(toRaw(quote)));
    const filePath = await window.electronAPI.generatePDF("devis", raw);
    if (filePath) {
      alert(`PDF généré avec succès !\nEmplacement : ${filePath}`);
    }
  } catch (err) {
    console.error("Failed to generate PDF:", err);
    alert(`Erreur lors de la génération du PDF : ${err.message}`);
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}
</script>

<style scoped lang="scss">
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
