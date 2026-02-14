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
              <option value="payé">Payé</option>
              <option value="en retard">En retard</option>
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
      <div v-else class="table-wrapper card">
        <div v-if="documents.length === 0" class="empty-state">
          <p>Aucune facture trouvée</p>
          <button @click="createNew" class="btn btn-secondary">
            Créer votre première facture
          </button>
        </div>

        <table v-else class="table">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Date</th>
              <th>Client</th>
              <th>Montant TTC</th>
              <th>Échéance</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="invoice in documents" :key="invoice.id">
              <td class="numero">{{ invoice.numero }}</td>
              <td>{{ invoice.date }}</td>
              <td class="client-name">{{ invoice.customer.customerName }}</td>
              <td class="amount">
                {{ formatCurrency(invoice.totals.totalTTC) }}
              </td>
              <td>{{ invoice.dueDate }}</td>
              <td>
                <span :class="['status-badge', `status-${invoice.status}`]">
                  {{ invoice.status }}
                </span>
              </td>
              <td class="actions-cell">
                <button
                  @click="edit(invoice.id)"
                  class="btn-icon"
                  title="Modifier"
                >
                  ✏️
                </button>
                <button
                  @click="generatePDF(invoice)"
                  class="btn-icon"
                  title="Générer PDF"
                >
                  📄
                </button>
                <button
                  @click="confirmDelete(invoice)"
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
    </div>

    <!-- Modal de confirmation de suppression -->
    <div v-if="showDeleteModal" class="modal-overlay" @click="cancelDelete">
      <div class="modal" @click.stop>
        <h3>Confirmer la suppression</h3>
        <p>
          Êtes-vous sûr de vouloir supprimer la facture
          <strong>{{ invoiceToDelete?.numero }}</strong> ?
        </p>
        <p class="warning">Cette action est irréversible.</p>
        <div class="modal-actions">
          <button @click="cancelDelete" class="btn btn-secondary">
            Annuler
          </button>
          <button @click="deleteInvoice" class="btn btn-danger">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useDocuments } from "@/composables/useDocuments";

const router = useRouter();
const { documents, loading, error, loadAll, remove } = useDocuments("factures");

const currentYear = new Date().getFullYear();
const filters = ref({
  search: "",
  status: "",
  year: currentYear,
});

const showDeleteModal = ref(false);
const invoiceToDelete = ref(null);

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

function confirmDelete(invoice) {
  invoiceToDelete.value = invoice;
  showDeleteModal.value = true;
}

function cancelDelete() {
  invoiceToDelete.value = null;
  showDeleteModal.value = false;
}

async function deleteInvoice() {
  if (!invoiceToDelete.value) return;

  try {
    await remove(invoiceToDelete.value.id);
    showDeleteModal.value = false;
    invoiceToDelete.value = null;
  } catch (err) {
    console.error("Failed to delete invoice:", err);
  }
}

async function generatePDF(invoice) {
  try {
    const filePath = await window.electronAPI.generatePDF("factures", invoice);
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

.invoice-list-view {
  padding: $spacing-lg;

  .container {
    max-width: 1400px;
    margin: 0 auto;
  }

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

  .table-wrapper {
    overflow-x: auto;

    .table {
      width: 100%;
      border-collapse: collapse;

      thead {
        background-color: $grey-20;
        border-bottom: 2px solid $grey-30;

        th {
          padding: $spacing-sm $spacing-md;
          text-align: left;
          font-weight: 600;
          color: $grey-100;
          font-size: $font-size-sm;
        }
      }

      tbody {
        tr {
          border-bottom: 1px solid $grey-30;
          transition: $transition-base;

          &:hover {
            background-color: $grey-50;
          }

          td {
            padding: $spacing-sm $spacing-md;
            color: $grey-100;

            &.numero {
              font-weight: 600;
              font-family: monospace;
            }

            &.client-name {
              @include truncate;
              max-width: 300px;
            }

            &.amount {
              font-weight: 600;
              text-align: right;
            }

            &.actions-cell {
              white-space: nowrap;
            }
          }
        }
      }
    }
  }
}
</style>
