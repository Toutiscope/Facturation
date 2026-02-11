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
@use "sass:color";
@use "@/styles/variables" as *;

.invoice-list-view {
  padding: $spacing-lg;

  .container {
    max-width: 1400px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: $spacing-xl;

    h1 {
      font-size: $font-size-3xl;
      font-weight: 700;
      color: $text-primary;
    }

    .btn-primary {
      padding: $spacing-sm $spacing-lg;
      background-color: $primary-color;
      color: white;
      border: none;
      border-radius: $border-radius-md;
      font-size: $font-size-base;
      font-weight: 500;
      cursor: pointer;
      transition: $transition-base;

      &:hover {
        background-color: darken($primary-color, 10%);
      }
    }
  }

  .card {
    background: white;
    padding: $spacing-lg;
    border-radius: $border-radius-md;
    box-shadow: $shadow-sm;
    margin-bottom: $spacing-lg;
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
        display: block;
        font-weight: 500;
        margin-bottom: $spacing-xs;
        color: $text-primary;
        font-size: $font-size-sm;
      }

      .form-control {
        width: 100%;
        padding: $spacing-sm;
        border: 1px solid $border-color;
        border-radius: $border-radius-sm;
        font-size: $font-size-base;
        transition: $transition-base;

        &:focus {
          outline: none;
          border-color: $primary-color;
          box-shadow: 0 0 0 3px rgba($primary-color, 0.1);
        }
      }
    }
  }

  .loading,
  .error {
    padding: $spacing-md;
    border-radius: $border-radius-md;
    text-align: center;
  }

  .loading {
    background-color: $gray-100;
  }

  .error {
    background-color: color.scale($error, $lightness: 40%);
    color: $error;
  }

  .table-wrapper {
    overflow-x: auto;

    .empty-state {
      text-align: center;
      padding: $spacing-2xl;
      color: $text-secondary;

      p {
        margin-bottom: $spacing-md;
        font-size: $font-size-lg;
      }
    }

    .table {
      width: 100%;
      border-collapse: collapse;

      thead {
        background-color: $gray-100;
        border-bottom: 2px solid $border-color;

        th {
          padding: $spacing-sm $spacing-md;
          text-align: left;
          font-weight: 600;
          color: $text-primary;
          font-size: $font-size-sm;
        }
      }

      tbody {
        tr {
          border-bottom: 1px solid $border-color;
          transition: $transition-base;

          &:hover {
            background-color: $gray-50;
          }

          td {
            padding: $spacing-sm $spacing-md;
            color: $text-primary;

            &.numero {
              font-weight: 600;
              font-family: monospace;
            }

            &.client-name {
              max-width: 300px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            &.amount {
              font-weight: 600;
              text-align: right;
            }

            .status-badge {
              display: inline-block;
              padding: $spacing-xs $spacing-sm;
              border-radius: $border-radius-sm;
              font-size: $font-size-xs;
              font-weight: 500;
              text-transform: capitalize;

              &.status-brouillon {
                background-color: lighten($gray-300, 10%);
                color: $text-secondary;
              }

              &.status-envoyé {
                background-color: lighten($primary-color, 40%);
                color: darken($primary-color, 10%);
              }

              &.status-payé {
                background-color: lighten($success, 40%);
                color: darken($success, 10%);
              }

              &.status-en.retard {
                background-color: color.scale($error, $lightness: 40%);
                color: darken($error, 10%);
              }
            }

            &.actions-cell {
              white-space: nowrap;

              .btn-icon {
                background: none;
                border: none;
                cursor: pointer;
                font-size: $font-size-lg;
                padding: $spacing-xs;
                transition: $transition-base;
                margin-right: $spacing-xs;

                &:hover {
                  transform: scale(1.1);
                }

                &.btn-danger:hover {
                  filter: brightness(1.2);
                }
              }
            }
          }
        }
      }
    }
  }

  // Modal styles
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    padding: $spacing-xl;
    border-radius: $border-radius-lg;
    box-shadow: $shadow-lg;
    max-width: 500px;
    width: 90%;

    h3 {
      font-size: $font-size-xl;
      font-weight: 600;
      margin-bottom: $spacing-md;
      color: $text-primary;
    }

    p {
      margin-bottom: $spacing-sm;
      color: $text-secondary;

      &.warning {
        color: $error;
        font-weight: 500;
      }

      strong {
        color: $text-primary;
        font-weight: 600;
      }
    }

    .modal-actions {
      display: flex;
      gap: $spacing-md;
      justify-content: flex-end;
      margin-top: $spacing-lg;
    }
  }
}
</style>
