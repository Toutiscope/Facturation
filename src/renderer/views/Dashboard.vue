<template>
  <div class="dashboard">
    <div class="container">
      <div class="header">
        <h1>Tableau de bord</h1>
      </div>

      <!-- Tableau des devis -->
      <section class="dashboard-section">
        <div class="section-header">
          <h2>Derniers devis</h2>
          <router-link
            to="/devis/nouveau"
            class="btn btn-primary btn-sm mg-left-auto mg-right-16"
          >
            Nouveau devis
          </router-link>
          <router-link to="/devis" class="btn btn-outline btn-sm">
            Voir tout
          </router-link>
        </div>

        <div v-if="quotesLoading" class="loading">Chargement...</div>
        <div v-else-if="quotesError" class="error">{{ quotesError }}</div>
        <QuoteTable
          v-else
          :quotes="latestQuotes"
          show-objet
          @edit="(id) => router.push(`/devis/${id}`)"
          @convert="convertToInvoice"
          @status-change="updateQuoteStatus"
          @delete="deleteQuote"
        />
      </section>

      <!-- Tableau des factures -->
      <section class="dashboard-section">
        <div class="section-header">
          <h2>Dernières factures</h2>
          <router-link
            to="/factures/nouvelle"
            class="btn btn-primary btn-sm mg-left-auto mg-right-16"
          >
            Nouvelle facture
          </router-link>
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
                <th>Numéro</th>
                <th>Date</th>
                <th>Client</th>
                <th>Objet</th>
                <th>Montant TTC</th>
                <th>Echeance</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="invoice in latestInvoices"
                :key="invoice.id"
                class="pointer"
                @click="router.push(`/factures/${invoice.id}`)"
              >
                <td class="numero">{{ invoice.numero }}</td>
                <td>{{ invoice.date }}</td>
                <td class="client-name">
                  {{ invoice.customer?.customerName }}
                </td>
                <td>
                  {{ invoice.object }}
                </td>
                <td class="amount">
                  {{ formatCurrency(invoice.totals?.totalTTC) }}
                </td>
                <td>{{ invoice.dueDate }}</td>
                <td>
                  <span :class="['status-badge', `status-${invoice.status}`]">
                    {{ invoice.status }}
                  </span>
                </td>
                <td class="actions-cell">
                  <button
                    @click.stop="generateInvoicePDF(invoice)"
                    class="btn-icon"
                    title="Générer PDF"
                  >
                    📄
                  </button>
                  <button
                    @click.stop="confirmDeleteInvoice(invoice)"
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
      </section>
    </div>

    <ConfirmModal
      :visible="showDeleteInvoiceModal"
      @cancel="cancelDeleteInvoice"
      @confirm="deleteInvoice"
    >
      Êtes-vous sûr de vouloir supprimer la facture
      <strong>{{ invoiceToDelete?.numero }}</strong> ?
    </ConfirmModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, toRaw } from "vue";
import { useRouter } from "vue-router";
import { useDocuments } from "@/composables/useDocuments";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import QuoteTable from "@/components/tables/QuoteTable.vue";

const router = useRouter();

const {
  documents: quotes,
  loading: quotesLoading,
  error: quotesError,
  loadAll: loadQuotes,
  save: saveQuote,
  remove: removeQuote,
} = useDocuments("devis");

const {
  documents: invoices,
  loading: invoicesLoading,
  error: invoicesError,
  loadAll: loadInvoices,
  remove: removeInvoice,
} = useDocuments("factures");

const currentYear = new Date().getFullYear();

const latestQuotes = computed(() => quotes.value.slice(0, 5));
const latestInvoices = computed(() => invoices.value.slice(0, 5));

const showDeleteInvoiceModal = ref(false);
const invoiceToDelete = ref(null);

onMounted(async () => {
  await Promise.all([
    loadQuotes({ year: currentYear }),
    loadInvoices({ year: currentYear }),
  ]);
});

// --- PDF ---

async function generateInvoicePDF(invoice) {
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

// --- Conversion devis ---

function convertToInvoice(quote) {
  // Stocker le devis dans sessionStorage pour pré-remplir la facture
  sessionStorage.setItem("quoteToConvert", JSON.stringify(quote));
  router.push("/factures/nouvelle");
}

// --- Statut devis ---

async function updateQuoteStatus(quote, status) {
  try {
    const raw = JSON.parse(JSON.stringify(quote));
    raw.status = status;
    await saveQuote(raw);
  } catch (err) {
    console.error("Failed to update quote status:", err);
  }
}

// --- Suppression devis ---

async function deleteQuote(id) {
  try {
    await removeQuote(id);
  } catch (err) {
    console.error("Failed to delete quote:", err);
  }
}

// --- Suppression facture ---

function confirmDeleteInvoice(invoice) {
  invoiceToDelete.value = invoice;
  showDeleteInvoiceModal.value = true;
}

function cancelDeleteInvoice() {
  invoiceToDelete.value = null;
  showDeleteInvoiceModal.value = false;
}

async function deleteInvoice() {
  if (!invoiceToDelete.value) return;
  try {
    await removeInvoice(invoiceToDelete.value.id);
    showDeleteInvoiceModal.value = false;
    invoiceToDelete.value = null;
  } catch (err) {
    console.error("Failed to delete invoice:", err);
  }
}

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
</style>
