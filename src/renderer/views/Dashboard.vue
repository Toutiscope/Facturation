<template>
  <div class="dashboard">
    <div class="container">
      <div class="header">
        <h1>Tableau de bord</h1>
      </div>

      <!-- Tableau des devis -->
      <section class="dashboard-section">
        <div class="section-header">
          <h2>Devis</h2>
          <router-link to="/devis" class="btn btn-outline btn-sm">
            Voir tout
          </router-link>
        </div>

        <div v-if="quotesLoading" class="loading">Chargement...</div>
        <div v-else-if="quotesError" class="error">{{ quotesError }}</div>
        <div v-else class="table-wrapper card">
          <div v-if="quotes.length === 0" class="empty-state">
            <p>Aucun devis</p>
          </div>
          <table v-else class="table">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Date</th>
                <th>Client</th>
                <th>Montant TTC</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="quote in quotes" :key="quote.id">
                <td class="numero">{{ quote.numero }}</td>
                <td>{{ quote.date }}</td>
                <td class="client-name">{{ quote.customer?.customerName }}</td>
                <td class="amount">
                  {{ formatCurrency(quote.totals?.totalTTC) }}
                </td>
                <td>
                  <span :class="['status-badge', `status-${quote.status}`]">
                    {{ quote.status }}
                  </span>
                </td>
                <td class="actions-cell">
                  <button
                    @click="router.push(`/devis/${quote.id}`)"
                    class="btn-icon"
                    title="Modifier"
                  >
                    ✏️
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Tableau des factures -->
      <section class="dashboard-section">
        <div class="section-header">
          <h2>Factures</h2>
          <router-link to="/factures" class="btn btn-outline btn-sm">
            Voir tout
          </router-link>
        </div>

        <div v-if="invoicesLoading" class="loading">Chargement...</div>
        <div v-else-if="invoicesError" class="error">{{ invoicesError }}</div>
        <div v-else class="table-wrapper card">
          <div v-if="invoices.length === 0" class="empty-state">
            <p>Aucune facture</p>
          </div>
          <table v-else class="table">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Date</th>
                <th>Client</th>
                <th>Montant TTC</th>
                <th>Echeance</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="invoice in invoices" :key="invoice.id">
                <td class="numero">{{ invoice.numero }}</td>
                <td>{{ invoice.date }}</td>
                <td class="client-name">
                  {{ invoice.customer?.customerName }}
                </td>
                <td class="amount">
                  {{ formatCurrency(invoice.totals?.totalTTC) }}
                </td>
                <td>{{ invoice.dueDate }}</td>
                <td>
                  <span
                    :class="['status-badge', `status-${invoice.status}`]"
                  >
                    {{ invoice.status }}
                  </span>
                </td>
                <td class="actions-cell">
                  <button
                    @click="router.push(`/factures/${invoice.id}`)"
                    class="btn-icon"
                    title="Modifier"
                  >
                    ✏️
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useDocuments } from "@/composables/useDocuments";

const router = useRouter();

const {
  documents: quotes,
  loading: quotesLoading,
  error: quotesError,
  loadAll: loadQuotes,
} = useDocuments("devis");

const {
  documents: invoices,
  loading: invoicesLoading,
  error: invoicesError,
  loadAll: loadInvoices,
} = useDocuments("factures");

const currentYear = new Date().getFullYear();

onMounted(async () => {
  await Promise.all([
    loadQuotes({ year: currentYear }),
    loadInvoices({ year: currentYear }),
  ]);
});

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;
@use "@/styles/mixins" as *;

.dashboard {
  padding: $spacing-lg;

  .container {
    max-width: 1400px;
    margin: 0 auto;
  }

  .header {
    @include page-header;
  }
}

.dashboard-section {
  margin-bottom: $spacing-2xl;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;

  h2 {
    margin: 0;
  }
}

.btn-sm {
  padding: $spacing-xs $spacing-md;
  font-size: $font-size-sm;
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
</style>
