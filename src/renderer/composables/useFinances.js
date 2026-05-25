import { ref, computed } from 'vue'

/**
 * Convertit une facture en transaction normalisée (lecture seule).
 */
function invoiceToTransaction(invoice) {
  const amount = invoice.totals?.totalTTC ?? 0
  const status = invoice.status || 'draft'
  return {
    id: `invoice-${invoice.id}`,
    invoiceId: invoice.id,
    source: 'facture',
    type: 'revenu',
    date: invoice.date || '',
    isoDate: parseFrDate(invoice.date) || invoice.createdAt || '',
    label: `Facture ${invoice.numero} — ${invoice.customer?.customerName || invoice.customer?.companyName || ''}`.trim(),
    category: 'Prestation',
    amount,
    signedAmount: amount,
    paymentMethod: null,
    party: invoice.customer?.customerName || invoice.customer?.companyName || '',
    note: invoice.object || '',
    paid: status === 'paid',
    invoiceStatus: status,
    invoiceObject: invoice.object || ''
  }
}

/**
 * Convertit une transaction manuelle stockée en transaction normalisée.
 */
function manualToTransaction(t) {
  const sign = t.type === 'depense' ? -1 : 1
  const amount = Math.abs(Number(t.amount) || 0)
  return {
    id: t.id,
    source: 'manuel',
    type: t.type,
    date: t.date || '',
    isoDate: t.isoDate || parseFrDate(t.date) || t.createdAt || '',
    label: t.label || '',
    category: t.category || '',
    amount,
    signedAmount: sign * amount,
    paymentMethod: t.paymentMethod || null,
    party: t.party || '',
    note: t.note || '',
    raw: t
  }
}

/**
 * Parse "DD/MM/YYYY" -> ISO string. Tolerant: returns null if invalid.
 */
function parseFrDate(str) {
  if (!str || typeof str !== 'string') return null
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00`).toISOString()
}

function isoToFr(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

export function useFinances() {
  const invoices = ref([])
  const manualTransactions = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function loadAll(year) {
    loading.value = true
    error.value = null
    try {
      const targetYear = year || new Date().getFullYear()
      const [inv, manual] = await Promise.all([
        window.electronAPI.loadDocuments('factures', { year: targetYear }),
        window.electronAPI.loadTransactions()
      ])
      invoices.value = inv || []
      manualTransactions.value = manual || []
    } catch (err) {
      error.value = err.message || 'Erreur lors du chargement des finances'
      console.error('Failed to load finances:', err)
    } finally {
      loading.value = false
    }
  }

  async function saveTransaction(transaction) {
    const raw = JSON.parse(JSON.stringify(transaction))
    const saved = await window.electronAPI.saveTransaction(raw)
    const idx = manualTransactions.value.findIndex(t => t.id === saved.id)
    if (idx >= 0) {
      manualTransactions.value.splice(idx, 1, saved)
    } else {
      manualTransactions.value.push(saved)
    }
    return saved
  }

  async function removeTransaction(id) {
    await window.electronAPI.deleteTransaction(id)
    manualTransactions.value = manualTransactions.value.filter(t => t.id !== id)
  }

  // Liste unifiée et triée
  const transactions = computed(() => {
    const inv = invoices.value.map(invoiceToTransaction)
    const man = manualTransactions.value.map(manualToTransaction)
    return [...inv, ...man].sort((a, b) => {
      const dateA = a.isoDate || ''
      const dateB = b.isoDate || ''
      return dateB.localeCompare(dateA)
    })
  })

  /**
   * Filtre par période (Mois courant, Trimestre, Année)
   */
  function filterByPeriod(list, period) {
    const now = new Date()
    return list.filter(t => {
      if (!t.isoDate) return false
      const d = new Date(t.isoDate)
      if (Number.isNaN(d.getTime())) return false
      if (period === 'Mois') {
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      }
      if (period === 'Trimestre') {
        return d.getFullYear() === now.getFullYear()
          && Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3)
      }
      if (period === 'Année') {
        return d.getFullYear() === now.getFullYear()
      }
      return false
    })
  }

  /**
   * Calcule les KPIs pour une liste de transactions.
   * Les KPIs ont une sémantique fixe (mois courant / année courante) et
   * ne suivent pas la période sélectionnée dans l'UI.
   */
  function computeKpis(list) {
    const filteredMonth = filterByPeriod(list, 'Mois')
    const filteredYear = filterByPeriod(list, 'Année')

    const sumRevenue = (txs) =>
      txs.filter(t => t.type === 'revenu').reduce((s, t) => s + t.amount, 0)
    const sumExpense = (txs) =>
      txs.filter(t => t.type === 'depense').reduce((s, t) => s + t.amount, 0)

    const caMonth = sumRevenue(filteredMonth)
    const caYear = sumRevenue(filteredYear)
    const expenseYear = sumExpense(filteredYear)
    const benefit = caYear - expenseYear
    const margin = caYear > 0 ? Math.round((benefit / caYear) * 100) : 0

    const invoiceTxs = filteredYear.filter(t => t.source === 'facture')
    const paid = invoiceTxs.filter(t => t.paid).reduce((s, t) => s + t.amount, 0)
    const pending = invoiceTxs.filter(t => !t.paid).reduce((s, t) => s + t.amount, 0)
    const pendingCount = invoiceTxs.filter(t => !t.paid).length

    return {
      caMonth,
      caYear,
      expense: expenseYear,
      benefit,
      margin,
      paid,
      paidRatio: caYear > 0 ? Math.round((paid / caYear) * 100) : 0,
      pending,
      pendingCount
    }
  }

  /**
   * Évolution mensuelle revenus vs dépenses sur l'année courante
   */
  function computeMonthlySeries(list) {
    const year = new Date().getFullYear()
    const revenue = Array(12).fill(0)
    const expense = Array(12).fill(0)
    for (const t of list) {
      if (!t.isoDate) continue
      const d = new Date(t.isoDate)
      if (d.getFullYear() !== year) continue
      const m = d.getMonth()
      if (t.type === 'revenu') revenue[m] += t.amount
      else if (t.type === 'depense') expense[m] += t.amount
    }
    return { revenue, expense }
  }

  /**
   * Répartition des revenus par source
   */
  function computeRevenueBySource(list) {
    let invoiceTotal = 0
    let manualTotal = 0
    for (const t of list) {
      if (t.type !== 'revenu') continue
      if (t.source === 'facture') invoiceTotal += t.amount
      else manualTotal += t.amount
    }
    const total = invoiceTotal + manualTotal
    return {
      total,
      segments: [
        { label: 'Factures pro', value: invoiceTotal },
        { label: 'Particuliers / manuels', value: manualTotal }
      ]
    }
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
    computeRevenueBySource,

    // utils
    isoToFr,
    parseFrDate
  }
}
