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
        <div v-else class="table-wrapper card">
          <div v-if="quotes.length === 0" class="empty-state">
            <p>Aucun devis</p>
          </div>
          <table v-else class="table">
            <thead>
              <tr>
                <th style="width: 90px">Numéro</th>
                <th style="width: 120px">Date</th>
                <th style="min-width: 200px">Client</th>
                <th style="width: 50%">Objet</th>
                <th style="width: 60px">Montant TTC</th>
                <th style="width: 150px">Statut</th>
                <th style="width: 180px">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="quote in latestQuotes"
                :key="quote.id"
                class="pointer"
                @click="router.push(`/devis/${quote.id}`)"
              >
                <td class="numero">{{ quote.numero }}</td>
                <td>{{ quote.date }}</td>
                <td class="client-name">{{ quote.customer?.customerName }}</td>
                <td>{{ quote.object }}</td>
                <td class="amount">
                  {{ formatCurrency(quote.totals?.totalTTC) }}
                </td>
                <td>
                  <span :class="['status-badge', `status-${quote.status}`]">
                    {{ quote.status }}
                  </span>
                </td>
                <td class="actions-cell">
                  <div
                    class="flex flex-vertical-center flex-space-between gap-8"
                  >
                    <button
                      @click.stop="convertToInvoice(quote)"
                      class="btn btn-primary btn-sm"
                    >
                      Convertir en facture
                    </button>
                    <button
                      @click.stop="confirmDeleteQuote(quote)"
                      class="btn-icon"
                      title="Supprimer"
                    >
                      <svg
                        height="24"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 640 640"
                      >
                        <path
                          fill="#244b63"
                          d="M232.7 69.9c4.4-13.1 16.6-21.9 30.4-21.9H377c13.8 0 26 8.8 30.4 21.9L416 96h96c17.7 0 32 14.3 32 32s-14.3 32-32 32H128c-17.7 0-32-14.3-32-32s14.3-32 32-32h96l8.7-26.1zM128 208h384v304c0 35.3-28.7 64-64 64H192c-35.3 0-64-28.7-64-64V208zm88 64c-13.3 0-24 10.7-24 24v192c0 13.3 10.7 24 24 24s24-10.7 24-24V296c0-13.3-10.7-24-24-24zm104 0c-13.3 0-24 10.7-24 24v192c0 13.3 10.7 24 24 24s24-10.7 24-24V296c0-13.3-10.7-24-24-24zm104 0c-13.3 0-24 10.7-24 24v192c0 13.3 10.7 24 24 24s24-10.7 24-24V296c0-13.3-10.7-24-24-24z"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
      :visible="showDeleteQuoteModal"
      @cancel="cancelDeleteQuote"
      @confirm="deleteQuote"
    >
      Êtes-vous sûr de vouloir supprimer le devis
      <strong>{{ quoteToDelete?.numero }}</strong> ?
    </ConfirmModal>

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

const router = useRouter();

const {
  documents: quotes,
  loading: quotesLoading,
  error: quotesError,
  loadAll: loadQuotes,
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

const showDeleteQuoteModal = ref(false);
const quoteToDelete = ref(null);
const showDeleteInvoiceModal = ref(false);
const invoiceToDelete = ref(null);

onMounted(async () => {
  await Promise.all([
    loadQuotes({ year: currentYear }),
    loadInvoices({ year: currentYear }),
  ]);
});

// --- PDF ---

async function generateQuotePDF(quote) {
  try {
    const raw = JSON.parse(JSON.stringify(toRaw(quote)));
    const filePath = await window.electronAPI.generatePDF("devis", raw);
    if (filePath) {
      alert(`PDF généré avec succès !\nEmplacement : ${filePath}`);
    }
  } catch (err) {
    alert(`Erreur lors de la génération du PDF : ${err.message}`);
  }
}

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

// --- Suppression devis ---

function confirmDeleteQuote(quote) {
  quoteToDelete.value = quote;
  showDeleteQuoteModal.value = true;
}

function cancelDeleteQuote() {
  quoteToDelete.value = null;
  showDeleteQuoteModal.value = false;
}

async function deleteQuote() {
  if (!quoteToDelete.value) return;
  try {
    await removeQuote(quoteToDelete.value.id);
    showDeleteQuoteModal.value = false;
    quoteToDelete.value = null;
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
