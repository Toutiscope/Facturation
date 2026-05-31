import { ref, computed } from "vue";

/**
 * Convertit une facture en transaction normalisée (lecture seule).
 */
function invoiceToTransaction(invoice) {
  const amount = invoice.totals?.totalTTC ?? 0;
  const status = invoice.status || "draft";
  return {
    id: `invoice-${invoice.id}`,
    invoiceId: invoice.id,
    source: "facture",
    type: "revenu",
    date: invoice.date || "",
    isoDate: parseFrDate(invoice.date) || invoice.createdAt || "",
    label:
      `Facture ${invoice.numero} — ${invoice.customer?.customerName || invoice.customer?.companyName || ""}`.trim(),
    category: "Prestation",
    amount,
    signedAmount: amount,
    paymentMethod: null,
    party:
      invoice.customer?.customerName || invoice.customer?.companyName || "",
    note: invoice.object || "",
    paid: status === "paid",
    invoiceStatus: status,
    invoiceObject: invoice.object || "",
  };
}

/**
 * Convertit une transaction manuelle stockée en transaction normalisée.
 */
function manualToTransaction(t) {
  const sign = t.type === "depense" ? -1 : 1;
  const amount = Math.abs(Number(t.amount) || 0);
  return {
    id: t.id,
    source: "manuel",
    type: t.type,
    date: t.date || "",
    isoDate: t.isoDate || parseFrDate(t.date) || t.createdAt || "",
    label: t.label || "",
    category: t.category || "",
    amount,
    signedAmount: sign * amount,
    paymentMethod: t.paymentMethod || null,
    party: t.party || "",
    note: t.note || "",
    raw: t,
  };
}

/**
 * Parse "DD/MM/YYYY" -> ISO string. Tolerant: returns null if invalid.
 */
function parseFrDate(str) {
  if (!str || typeof str !== "string") return null;
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00`).toISOString();
}

function isoToFr(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function useFinances() {
  const invoices = ref([]);
  const manualTransactions = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function loadAll(year) {
    loading.value = true;
    error.value = null;
    try {
      const targetYear = year || new Date().getFullYear();
      const [inv, manual] = await Promise.all([
        window.electronAPI.loadDocuments("factures", { year: targetYear }),
        window.electronAPI.loadTransactions(),
      ]);
      invoices.value = inv || [];
      manualTransactions.value = manual || [];
    } catch (err) {
      error.value = err.message || "Erreur lors du chargement des finances";
      console.error("Failed to load finances:", err);
    } finally {
      loading.value = false;
    }
  }

  async function saveTransaction(transaction) {
    const raw = JSON.parse(JSON.stringify(transaction));
    const saved = await window.electronAPI.saveTransaction(raw);
    const idx = manualTransactions.value.findIndex((t) => t.id === saved.id);
    if (idx >= 0) {
      manualTransactions.value.splice(idx, 1, saved);
    } else {
      manualTransactions.value.push(saved);
    }
    return saved;
  }

  async function removeTransaction(id) {
    await window.electronAPI.deleteTransaction(id);
    manualTransactions.value = manualTransactions.value.filter(
      (t) => t.id !== id,
    );
  }

  // Liste unifiée et triée
  const transactions = computed(() => {
    const inv = invoices.value.map(invoiceToTransaction);
    const man = manualTransactions.value.map(manualToTransaction);
    return [...inv, ...man].sort((a, b) => {
      const dateA = a.isoDate || "";
      const dateB = b.isoDate || "";
      return dateB.localeCompare(dateA);
    });
  });

  /**
   * Filtre par période (Mois courant, Trimestre, Année)
   */
  function filterByPeriod(list, period) {
    const now = new Date();
    return list.filter((t) => {
      if (!t.isoDate) return false;
      const d = new Date(t.isoDate);
      if (Number.isNaN(d.getTime())) return false;
      if (period === "Mois") {
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      }
      if (period === "Trimestre") {
        return (
          d.getFullYear() === now.getFullYear() &&
          Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3)
        );
      }
      if (period === "Année") {
        return d.getFullYear() === now.getFullYear();
      }
      return false;
    });
  }

  /**
   * Une transaction est comptée dans le CA / bénéfice si :
   *  - c'est un revenu manuel (encaissé par nature)
   *  - OU une facture marquée comme payée
   * Les factures en attente ne sont PAS encore du chiffre d'affaires.
   */
  function isEarnedRevenue(t) {
    if (t.type !== "revenu") return false;
    if (t.source === "facture") return !!t.paid;
    return true;
  }

  /**
   * Calcule les KPIs pour une liste de transactions.
   * Les KPIs ont une sémantique fixe (mois courant / année courante) et
   * ne suivent pas la période sélectionnée dans l'UI.
   */
  function computeKpis(list) {
    const filteredMonth = filterByPeriod(list, "Mois");
    const filteredYear = filterByPeriod(list, "Année");

    const sumRevenue = (txs) =>
      txs.filter(isEarnedRevenue).reduce((s, t) => s + t.amount, 0);
    const sumExpense = (txs) =>
      txs.filter((t) => t.type === "depense").reduce((s, t) => s + t.amount, 0);

    const caMonth = sumRevenue(filteredMonth);
    const caYear = sumRevenue(filteredYear);
    const expenseYear = sumExpense(filteredYear);
    const benefit = caYear - expenseYear;
    const margin = caYear > 0 ? Math.round((benefit / caYear) * 100) : 0;

    const invoiceTxs = filteredYear.filter((t) => t.source === "facture");
    const paid = invoiceTxs
      .filter((t) => t.paid)
      .reduce((s, t) => s + t.amount, 0);
    const pending = invoiceTxs
      .filter((t) => !t.paid)
      .reduce((s, t) => s + t.amount, 0);
    const pendingCount = invoiceTxs.filter((t) => !t.paid).length;

    return {
      caMonth,
      caYear,
      expense: expenseYear,
      benefit,
      margin,
      paid,
      paidRatio: caYear > 0 ? Math.round((paid / caYear) * 100) : 0,
      pending,
      pendingCount,
    };
  }

  /**
   * Évolution mensuelle revenus vs dépenses sur l'année courante.
   * Seuls les revenus effectivement encaissés (factures payées + revenus
   * manuels) entrent dans la série revenue.
   */
  function computeMonthlySeries(list) {
    const year = new Date().getFullYear();
    const revenue = Array(12).fill(0);
    const expense = Array(12).fill(0);
    for (const t of list) {
      if (!t.isoDate) continue;
      const d = new Date(t.isoDate);
      if (d.getFullYear() !== year) continue;
      const m = d.getMonth();
      if (isEarnedRevenue(t)) revenue[m] += t.amount;
      else if (t.type === "depense") expense[m] += t.amount;
    }
    return { revenue, expense };
  }

  /**
   * Série temporelle adaptée à la période sélectionnée.
   *  - 'Mois'      : un point par jour du mois courant
   *  - 'Trimestre' : un point par semaine du trimestre courant (~13 semaines)
   *  - 'Année'     : un point par mois sur l'année courante
   *
   * Renvoie deux tableaux de labels :
   *  - `labels`     : labels courts (axe X)
   *  - `fullLabels` : labels longs (tooltip)
   */
  function computeChartSeries(list, period) {
    const now = new Date();
    const year = now.getFullYear();

    if (period === "Mois") {
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const revenue = Array(daysInMonth).fill(0);
      const expense = Array(daysInMonth).fill(0);
      const labels = Array.from({ length: daysInMonth }, (_, i) =>
        String(i + 1),
      );
      const fullLabels = Array.from({ length: daysInMonth }, (_, i) => {
        const d = new Date(year, month, i + 1);
        return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
      });
      for (const t of list) {
        if (!t.isoDate) continue;
        const d = new Date(t.isoDate);
        if (d.getFullYear() !== year || d.getMonth() !== month) continue;
        const idx = d.getDate() - 1;
        if (isEarnedRevenue(t)) revenue[idx] += t.amount;
        else if (t.type === "depense") expense[idx] += t.amount;
      }
      return { revenue, expense, labels, fullLabels };
    }

    if (period === "Trimestre") {
      const quarter = Math.floor(now.getMonth() / 3);
      const startMonth = quarter * 3;
      const monthsInQuarter = [0, 1, 2];
      const longMonthNames = [
        "Janvier",
        "Février",
        "Mars",
        "Avril",
        "Mai",
        "Juin",
        "Juillet",
        "Août",
        "Septembre",
        "Octobre",
        "Novembre",
        "Décembre",
      ];
      const shortMonthNames = [
        "J",
        "F",
        "M",
        "A",
        "M",
        "J",
        "J",
        "A",
        "S",
        "O",
        "N",
        "D",
      ];
      const revenue = Array(3).fill(0);
      const expense = Array(3).fill(0);
      const labels = monthsInQuarter.map(
        (i) => shortMonthNames[startMonth + i],
      );
      const fullLabels = monthsInQuarter.map(
        (i) => `${longMonthNames[startMonth + i]} ${year}`,
      );
      for (const t of list) {
        if (!t.isoDate) continue;
        const d = new Date(t.isoDate);
        if (d.getFullYear() !== year) continue;
        const m = d.getMonth();
        if (m < startMonth || m > startMonth + 2) continue;
        const idx = m - startMonth;
        if (isEarnedRevenue(t)) revenue[idx] += t.amount;
        else if (t.type === "depense") expense[idx] += t.amount;
      }
      return { revenue, expense, labels, fullLabels };
    }

    // Année (par défaut)
    const longMonthNames = [
      "Janvier",
      "Février",
      "Mars",
      "Avril",
      "Mai",
      "Juin",
      "Juillet",
      "Août",
      "Septembre",
      "Octobre",
      "Novembre",
      "Décembre",
    ];
    const shortMonthNames = [
      "J",
      "F",
      "M",
      "A",
      "M",
      "J",
      "J",
      "A",
      "S",
      "O",
      "N",
      "D",
    ];
    const { revenue, expense } = computeMonthlySeries(list);
    return {
      revenue,
      expense,
      labels: shortMonthNames,
      fullLabels: longMonthNames.map((m) => `${m} ${year}`),
    };
  }

  /**
   * Répartition des revenus encaissés par source.
   * Les factures en attente ne sont pas comptabilisées.
   */
  function computeRevenueBySource(list) {
    let invoiceTotal = 0;
    let manualTotal = 0;
    for (const t of list) {
      if (!isEarnedRevenue(t)) continue;
      if (t.source === "facture") invoiceTotal += t.amount;
      else manualTotal += t.amount;
    }
    const total = invoiceTotal + manualTotal;
    return {
      total,
      segments: [
        { label: "Factures pro", value: invoiceTotal },
        { label: "Particuliers / manuels", value: manualTotal },
      ],
    };
  }

  return {
    // state
    loading,
    error,
    invoices,
    manualTransactions,

    // computed
    transactions,

    // actions
    loadAll,
    saveTransaction,
    removeTransaction,

    // helpers
    filterByPeriod,
    computeKpis,
    computeMonthlySeries,
    computeChartSeries,
    computeRevenueBySource,

    // utils
    isoToFr,
    parseFrDate,
  };
}
