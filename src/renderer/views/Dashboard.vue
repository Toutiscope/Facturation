<template>
  <div class="dashboard">
    <div class="container">
      <div
        class="header flex flex-space-between flex-vertical-center mg-bottom-16"
      >
        <h1>Tableau de bord</h1>
        <router-link
          to="/devis/nouveau"
          class="btn btn-primary mg-left-auto mg-right-16"
        >
          + Nouveau devis
        </router-link>
        <router-link to="/factures/nouvelle" class="btn btn-primary">
          + Nouvelle facture
        </router-link>
      </div>

      <!-- Tableau des devis -->
      <section class="dashboard-section">
        <div class="section-header">
          <h2>Derniers devis</h2>
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
          <router-link to="/factures" class="btn btn-outline btn-sm">
            Voir tout
          </router-link>
        </div>

        <div v-if="invoicesLoading" class="loading">Chargement...</div>
        <div v-else-if="invoicesError" class="error">{{ invoicesError }}</div>
        <InvoiceTable
          v-else
          :invoices="latestInvoices"
          show-objet
          @edit="(id) => router.push(`/factures/${id}`)"
          @status-change="updateInvoiceStatus"
          @delete="deleteInvoice"
        />
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useDocuments } from "@/composables/useDocuments";
import QuoteTable from "@/components/tables/QuoteTable.vue";
import InvoiceTable from "@/components/tables/InvoiceTable.vue";

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
  save: saveInvoice,
  remove: removeInvoice,
} = useDocuments("factures");

const currentYear = new Date().getFullYear();

const latestQuotes = computed(() => quotes.value.slice(0, 5));
const latestInvoices = computed(() => invoices.value.slice(0, 5));

onMounted(async () => {
  await Promise.all([
    loadQuotes({ year: currentYear }),
    loadInvoices({ year: currentYear }),
  ]);
});

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

// --- Statut facture ---

async function updateInvoiceStatus(invoice, status) {
  try {
    const raw = JSON.parse(JSON.stringify(invoice));
    raw.status = status;
    await saveInvoice(raw);
  } catch (err) {
    console.error("Failed to update invoice status:", err);
  }
}

// --- Suppression facture ---

async function deleteInvoice(id) {
  try {
    await removeInvoice(id);
  } catch (err) {
    console.error("Failed to delete invoice:", err);
  }
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
