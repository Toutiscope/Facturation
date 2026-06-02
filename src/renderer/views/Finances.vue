<template>
  <div class="finances">
    <!-- Header -->
    <header class="finances__header">
      <div>
        <h1>Finances</h1>
        <small class="finances__subtitle">
          Vue d'ensemble · {{ periodLabel }}
        </small>
      </div>
      <div class="finances__header-actions">
        <div class="segmented" role="tablist">
          <button
            v-for="opt in periodOptions"
            :key="opt"
            :aria-selected="period === opt"
            :class="{ 'segmented__item--active': period === opt }"
            class="segmented__item"
            role="tab"
            type="button"
            @click="period = opt"
          >
            {{ opt }}
          </button>
        </div>
        <input
          v-model="selectedMonth"
          type="month"
          class="finances__month-picker"
          :disabled="period !== 'Mois'"
          :title="
            period === 'Mois'
              ? 'Choisir le mois affiché'
              : 'Disponible en vue Mois'
          "
          aria-label="Mois affiché"
          @click="openMonthPicker"
        />
        <div class="segmented">
          <button
            v-for="opt in chartTypeOptions"
            :key="opt.value"
            :class="{ 'segmented__item--active': chartType === opt.value }"
            :title="`Graphique en ${opt.label.toLowerCase()}`"
            class="segmented__item"
            type="button"
            @click="chartType = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
        <button class="btn btn-primary" type="button" @click="openSlideOver()">
          + Ajouter une transaction
        </button>
      </div>
    </header>

    <div v-if="loading" class="loading">Chargement…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <!-- KPI strip -->
      <section class="kpi-strip">
        <article class="kpi-card">
          <p class="kpi-card__label">CA mois en cours</p>
          <p class="kpi-card__value">{{ formatCurrency(kpis.caMonth) }}</p>
          <p class="kpi-card__delta kpi-card__delta--up">▲ Mois en cours</p>
          <p class="kpi-card__after-tax">
            <span class="kpi-card__after-tax-amount">
              ≈ {{ formatCurrency(kpis.caMonthAfterUrssaf) }}
            </span>
            après impôts
          </p>
        </article>
        <article class="kpi-card">
          <p class="kpi-card__label">CA total (annuel)</p>
          <p class="kpi-card__value">{{ formatCurrency(kpis.caYear) }}</p>
          <p class="kpi-card__delta kpi-card__delta--up">▲ Année en cours</p>
          <p class="kpi-card__after-tax">
            <span class="kpi-card__after-tax-amount">
              ≈ {{ formatCurrency(kpis.caYearAfterUrssaf) }}
            </span>
            après impôts
          </p>
        </article>
        <article class="kpi-card">
          <p class="kpi-card__label">Bénéfice net</p>
          <p class="kpi-card__value">{{ formatCurrency(kpis.benefit) }}</p>
          <p class="kpi-card__delta kpi-card__delta--up">
            Marge {{ kpis.margin }}%
          </p>
          <p class="kpi-card__after-tax">
            <span class="kpi-card__after-tax-amount">
              ≈ {{ formatCurrency(kpis.benefitAfterUrssaf) }}
            </span>
            après impôts
          </p>
        </article>
        <article class="kpi-card">
          <p class="kpi-card__label">Total dépenses</p>
          <p class="kpi-card__value">{{ formatCurrency(kpis.expense) }}</p>
          <p class="kpi-card__delta kpi-card__delta--down">▼ Année en cours</p>
        </article>
        <article class="kpi-card">
          <p class="kpi-card__label">Encaissé (factures)</p>
          <p class="kpi-card__value">{{ formatCurrency(kpis.paid) }}</p>
          <p class="kpi-card__delta">{{ kpis.paidRatio }}% du CA</p>
        </article>
        <article
          class="kpi-card kpi-card--clickable"
          role="button"
          tabindex="0"
          title="Voir les factures en attente"
          @click="goToPendingInvoices"
          @keydown.enter="goToPendingInvoices"
          @keydown.space.prevent="goToPendingInvoices"
        >
          <p class="kpi-card__label">En attente</p>
          <p class="kpi-card__value">{{ formatCurrency(kpis.pending) }}</p>
          <p class="kpi-card__delta">
            {{ kpis.pendingCount }}
            facture{{ kpis.pendingCount > 1 ? "s" : "" }}
          </p>
        </article>
      </section>

      <!-- Charts row -->
      <section class="charts-row">
        <article class="chart-card chart-card--wide">
          <header class="chart-card__header">
            <div>
              <h2>Revenus vs dépenses</h2>
              <p class="chart-card__sub">{{ chartSubtitle }}</p>
            </div>
            <div class="chart-card__legend">
              <span>
                <i class="legend-dot legend-dot--income" />
                Revenus
              </span>
              <span>
                <i class="legend-dot legend-dot--expense" />
                Dépenses
              </span>
            </div>
          </header>
          <MonthlyChart
            :clickable="period === 'Année'"
            :expense="chartSeries.expense"
            :full-labels="chartSeries.fullLabels"
            :height="220"
            :labels="chartSeries.labels"
            :revenue="chartSeries.revenue"
            :type="chartType"
            @point-click="onChartMonthClick"
          />
        </article>

        <article class="chart-card">
          <header class="chart-card__header">
            <div>
              <h2>Répartition des revenus</h2>
              <p class="chart-card__sub">Par type de client</p>
            </div>
          </header>
          <div class="chart-card__donut">
            <DonutChart :segments="revenueBySource.segments" :size="170" />
          </div>
        </article>
      </section>

      <!-- Transactions table -->
      <section class="card transactions-card">
        <header class="transactions-card__header">
          <div>
            <h2>{{ transactionsTitle }}</h2>
            <p class="transactions-card__sub">
              Factures et transactions manuelles
            </p>
          </div>
          <div class="filter-pills">
            <button
              v-for="opt in typeFilters"
              :key="opt.value"
              :class="{ 'filter-pill--active': typeFilter === opt.value }"
              class="filter-pill"
              type="button"
              @click="typeFilter = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </header>
        <TransactionsTable
          :rows="filteredTransactions"
          @delete="onDeleteRequest"
          @duplicate="onDuplicate"
          @edit="onEdit"
          @change-category="onChangeCategory"
          @open-invoice="onOpenInvoice"
        />
      </section>
    </template>

    <TransactionSlideOver
      :transaction="editingTransaction"
      :visible="slideOverVisible"
      @cancel="closeSlideOver"
      @save="onSave"
    />

    <ConfirmModal
      :visible="!!pendingDelete"
      confirm-label="Supprimer"
      title="Supprimer la transaction"
      @cancel="pendingDelete = null"
      @confirm="confirmDelete"
    >
      Êtes-vous sûr de vouloir supprimer la transaction
      <strong>{{ pendingDelete?.label }}</strong> ?
    </ConfirmModal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useFinances } from "@/composables/useFinances";
import { useToast } from "@/composables/useToast";
import MonthlyChart from "@/components/finances/MonthlyChart.vue";
import DonutChart from "@/components/finances/DonutChart.vue";
import TransactionsTable from "@/components/finances/TransactionsTable.vue";
import TransactionSlideOver from "@/components/finances/TransactionSlideOver.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";

const {
  loading,
  error,
  transactions,
  loadAll,
  saveTransaction,
  removeTransaction,
  computeKpis,
  computeChartSeries,
  computeRevenueBySource,
  filterByPeriod,
} = useFinances();

const { showToast } = useToast();
const router = useRouter();

function onOpenInvoice(invoiceId) {
  router.push(`/factures/${invoiceId}`);
}

// "En attente" = factures envoyées non encore réglées → liste filtrée sur ce statut.
function goToPendingInvoices() {
  router.push({ path: "/factures", query: { status: "sent" } });
}

const periodOptions = ["Mois", "Année"];
const period = ref("Mois");

// Mois ciblé pour la vue "Mois" (format "YYYY-MM"), initialisé au mois courant.
function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
const selectedMonth = ref(currentMonthValue());

// Date de référence dérivée du mois sélectionné (1er du mois).
const monthRefDate = computed(() => {
  const [y, m] = selectedMonth.value.split("-").map(Number);
  if (!y || !m) return new Date();
  return new Date(y, m - 1, 1);
});

// Date de référence effective : le mois choisi en vue "Mois", aujourd'hui sinon.
const effectiveRefDate = computed(() =>
  period.value === "Mois" ? monthRefDate.value : new Date(),
);

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

// Clic sur un mois du graphique annuel → bascule en vue mensuelle de ce mois.
// L'index reçu (0-11) correspond au mois de l'année en cours.
function onChartMonthClick(index) {
  if (period.value !== "Année") return;
  const year = new Date().getFullYear();
  selectedMonth.value = `${year}-${String(index + 1).padStart(2, "0")}`;
  period.value = "Mois";
}

const chartTypeOptions = [
  { value: "line", label: "Ligne" },
  { value: "area", label: "Aire" },
  { value: "bar", label: "Barres" },
];
const chartType = ref("line");

const typeFilters = [
  { value: "all", label: "Toutes" },
  { value: "revenu", label: "Revenus" },
  { value: "depense", label: "Dépenses" },
];
const typeFilter = ref("all");

const slideOverVisible = ref(false);
const editingTransaction = ref(null);
const pendingDelete = ref(null);

const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const periodLabel = computed(() => {
  const ref = effectiveRefDate.value;
  const year = ref.getFullYear();
  const month = ref.getMonth();
  if (period.value === "Mois") {
    return `${MONTH_NAMES[month]} ${year}`;
  }
  return `Année ${new Date().getFullYear()}`;
});

const transactionsTitle = computed(() => {
  if (period.value === "Mois") {
    const ref = effectiveRefDate.value;
    const monthName = MONTH_NAMES[ref.getMonth()];
    // Élision devant voyelle : "d'avril" vs "de janvier"
    const prefix = /^[aeiouéè]/.test(monthName) ? "d'" : "de ";
    return `Transactions ${prefix}${monthName} ${ref.getFullYear()}`;
  }
  return "Transactions de l'année";
});

// Taux URSSAF auto-entrepreneur prestation de services (BNC libéral) :
// cotisations sociales + CFP. Les cotisations URSSAF sont assises sur le CA,
// pas sur le bénéfice — on applique donc le taux sur le CA pour estimer le net.
const URSSAF_RATE = 0.232;

const kpis = computed(() => {
  const k = computeKpis(transactions.value);
  return {
    ...k,
    caMonthAfterUrssaf: k.caMonth * (1 - URSSAF_RATE),
    caYearAfterUrssaf: k.caYear * (1 - URSSAF_RATE),
    benefitAfterUrssaf: k.benefit - k.caYear * URSSAF_RATE,
  };
});

const chartSeries = computed(() =>
  computeChartSeries(transactions.value, period.value, effectiveRefDate.value),
);

const chartSubtitle = computed(() => {
  if (period.value === "Mois") {
    const ref = effectiveRefDate.value;
    return `Évolution jour par jour · ${MONTH_NAMES[ref.getMonth()]} ${ref.getFullYear()}`;
  }
  return `Évolution sur 12 mois · ${new Date().getFullYear()}`;
});

const revenueBySource = computed(() =>
  computeRevenueBySource(filterByPeriod(transactions.value, "Année")),
);

const filteredTransactions = computed(() => {
  const filteredByPeriod = filterByPeriod(
    transactions.value,
    period.value,
    effectiveRefDate.value,
  );
  const filteredByType =
    typeFilter.value === "all"
      ? filteredByPeriod
      : filteredByPeriod.filter((t) => t.type === typeFilter.value);
  return filteredByType.slice(0, 12);
});

function openSlideOver(transaction = null) {
  editingTransaction.value = transaction;
  slideOverVisible.value = true;
}

function closeSlideOver() {
  slideOverVisible.value = false;
  editingTransaction.value = null;
}

async function onSave(transaction) {
  try {
    await saveTransaction(transaction);
    closeSlideOver();
    showToast(
      transaction.id ? "Transaction modifiée" : "Transaction ajoutée",
      "success",
    );
  } catch (err) {
    showToast(err.message || "Erreur lors de l'enregistrement", "error");
  }
}

function onEdit(row) {
  openSlideOver(row);
}

function onDuplicate(row) {
  const dup = { ...row.raw };
  delete dup.id;
  delete dup.createdAt;
  delete dup.editedAt;
  openSlideOver({ raw: dup });
}

function onChangeCategory(row) {
  openSlideOver(row);
}

function onDeleteRequest(row) {
  pendingDelete.value = row;
}

async function confirmDelete() {
  const target = pendingDelete.value;
  pendingDelete.value = null;
  if (!target) return;
  try {
    await removeTransaction(target.id);
    showToast("Transaction supprimée", "success");
  } catch (err) {
    showToast(err.message || "Erreur lors de la suppression", "error");
  }
}

function formatCurrency(v) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v || 0);
}

onMounted(() => {
  loadAll();
});
</script>

<style lang="scss" scoped>
@use "sass:math";
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;
@use "@/styles/mixins" as *;

.finances {
  background: $grey-10;
  min-height: 100%;
  padding: $spacing-lg;
}

.finances__header {
  @include flex-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: $spacing-md;
  margin-bottom: $spacing-lg;

  h1 {
    margin: 0;
  }
}

.finances__subtitle {
  color: $grey-60;
  display: block;
  margin-top: $spacing-xs;
}

.finances__header-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.segmented {
  background: $white;
  border: 1px solid $grey-20;
  border-radius: $border-radius-md;
  display: inline-flex;
  padding: math.div($spacing-xs, 2);
}

.finances__month-picker {
  background: $white;
  border: 1px solid $grey-20;
  border-radius: $border-radius-md;
  color: $grey-90;
  cursor: pointer;
  font: inherit;
  font-size: $font-size-sm;
  font-weight: 500;
  padding: $spacing-xs $spacing-sm;

  &:disabled {
    background: $grey-10;
    color: $grey-50;
    cursor: not-allowed;
  }
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

.kpi-strip {
  display: grid;
  gap: $spacing-sm;
  grid-template-columns: repeat(6, 1fr);
  margin-bottom: $spacing-md;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 700px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.kpi-card {
  @include card;
  display: flex;
  flex-direction: column;
  padding: $spacing-md;

  &--clickable {
    cursor: pointer;
    transition: $transition-base;

    &:hover {
      border-color: $grey-40;
      box-shadow: $shadow-md;
    }

    &:focus-visible {
      outline: 2px solid $primary-color;
      outline-offset: 2px;
    }
  }
}

.kpi-card__label {
  color: $grey-60;
  font-size: $font-size-xs;
  font-weight: 500;
  letter-spacing: 0.5px;
  margin: 0;
  text-transform: uppercase;
}

.kpi-card__value {
  color: $grey-100;
  font-size: $font-size-2xl;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  letter-spacing: -0.4px;
  margin: $spacing-xs 0 0;
}

.kpi-card__delta {
  color: $grey-60;
  font-size: $font-size-xs;
  font-weight: 500;
  margin: auto 0 0;

  &--up {
    color: $success-color;
  }

  &--down {
    color: $error-color;
  }
}

.kpi-card__after-tax {
  color: $grey-60;
  font-size: $font-size-xs;
  font-variant-numeric: tabular-nums;
  font-weight: 400;
  margin: $spacing-xs 0 0;
}

.kpi-card__after-tax-amount {
  color: $grey-90;
  font-weight: 500;
}

.charts-row {
  display: grid;
  gap: $spacing-sm;
  grid-template-columns: 1.7fr 1fr;
  margin-bottom: $spacing-md;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  @include card;

  h2 {
    color: $grey-100;
    font-size: $font-size-base;
    font-weight: 600;
    margin: 0;
  }
}

.chart-card__header {
  @include flex-between;
  align-items: flex-start;
  gap: $spacing-md;
  margin-bottom: $spacing-sm;
}

.chart-card__sub {
  color: $grey-60;
  display: block;
  font-size: $font-size-xs;
  margin-top: math.div($spacing-xs, 2);
}

.chart-card__legend {
  color: $grey-90;
  display: flex;
  font-size: $font-size-xs;
  gap: $spacing-md;

  span {
    align-items: center;
    display: inline-flex;
    gap: $spacing-xs;
  }
}

.chart-card__donut {
  display: flex;
  justify-content: center;
  margin-top: $spacing-md;
}

.legend-dot {
  border-radius: math.div($border-radius-sm, 2);
  display: inline-block;
  height: $spacing-sm;
  width: $spacing-sm;

  &--income {
    background: $success-color;
  }

  &--expense {
    background: $error-color;
  }
}

.transactions-card {
  @include card;
  padding: 0;

  h2 {
    color: $grey-100;
    font-size: $font-size-base;
    font-weight: 600;
    margin: 0;
  }
}

.transactions-card__header {
  @include flex-between;
  flex-wrap: wrap;
  gap: $spacing-md;
  padding: $spacing-md $spacing-md $spacing-sm;
}

.transactions-card__sub {
  color: $grey-60;
  display: block;
  font-size: $font-size-xs;
  margin-top: math.div($spacing-xs, 2);
}

.filter-pills {
  display: flex;
  gap: $spacing-xs;
}

.filter-pill {
  background: $white;
  border: 1px solid $grey-20;
  border-radius: $border-radius-pill;
  color: $grey-90;
  cursor: pointer;
  font: inherit;
  font-size: $font-size-xs;
  font-weight: 500;
  padding: $spacing-xs $spacing-md;
  transition: $transition-base;

  &:hover {
    background: $grey-10;
  }

  &--active {
    background: $grey-100;
    border-color: $grey-100;
    color: $white;
  }
}
</style>
