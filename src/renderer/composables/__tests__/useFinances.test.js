import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useFinances } from "../useFinances.js";

// ── Helpers ──────────────────────────────────────────────────

/**
 * ISO string for a local date — timezone-safe roundtrip with getMonth/getFullYear.
 */
function localIso(year, month0, day = 1) {
  return new Date(year, month0, day).toISOString();
}

function txn(overrides = {}) {
  return {
    id: "x",
    source: "manuel",
    type: "revenu",
    amount: 100,
    isoDate: localIso(2026, 4, 15),
    label: "Test",
    category: "",
    ...overrides,
  };
}

function invoiceTxn(overrides = {}) {
  // Par défaut une facture est payée — les tests qui veulent une facture
  // en attente passent explicitement `paid: false`.
  return txn({ source: "facture", paid: true, ...overrides });
}

// ── Setup / Teardown ─────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  // "Now" = 25 mai 2026, 10:00 (heure locale)
  vi.setSystemTime(new Date(2026, 4, 25, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

// ──────────────────────────────────────────────────────────────
//  filterByPeriod
// ──────────────────────────────────────────────────────────────

describe("filterByPeriod", () => {
  it("keeps only the current month for 'Mois'", () => {
    const { filterByPeriod } = useFinances();
    const list = [
      txn({ id: "a", isoDate: localIso(2026, 4, 1) }), // mai
      txn({ id: "b", isoDate: localIso(2026, 4, 31) }), // mai (fin)
      txn({ id: "c", isoDate: localIso(2026, 3, 30) }), // avril
      txn({ id: "d", isoDate: localIso(2026, 5, 1) }), // juin
    ];
    const filtered = filterByPeriod(list, "Mois");
    expect(filtered.map((t) => t.id).sort()).toEqual(["a", "b"]);
  });

  it("keeps only the current quarter for 'Trimestre'", () => {
    const { filterByPeriod } = useFinances();
    // Q2 = avril, mai, juin
    const list = [
      txn({ id: "a", isoDate: localIso(2026, 3, 1) }), // avril ✓
      txn({ id: "b", isoDate: localIso(2026, 4, 15) }), // mai ✓
      txn({ id: "c", isoDate: localIso(2026, 5, 30) }), // juin ✓
      txn({ id: "d", isoDate: localIso(2026, 2, 31) }), // mars ✗
      txn({ id: "e", isoDate: localIso(2026, 6, 1) }), // juillet ✗
    ];
    const filtered = filterByPeriod(list, "Trimestre");
    expect(filtered.map((t) => t.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("keeps the entire current year for 'Année'", () => {
    const { filterByPeriod } = useFinances();
    const list = [
      txn({ id: "a", isoDate: localIso(2026, 0, 1) }),
      txn({ id: "b", isoDate: localIso(2026, 11, 31) }),
      txn({ id: "c", isoDate: localIso(2025, 11, 31) }),
      txn({ id: "d", isoDate: localIso(2027, 0, 1) }),
    ];
    const filtered = filterByPeriod(list, "Année");
    expect(filtered.map((t) => t.id).sort()).toEqual(["a", "b"]);
  });

  it("excludes transactions without isoDate", () => {
    const { filterByPeriod } = useFinances();
    const list = [
      txn({ id: "a", isoDate: localIso(2026, 4, 15) }),
      txn({ id: "b", isoDate: null }),
      txn({ id: "c", isoDate: "" }),
    ];
    const filtered = filterByPeriod(list, "Mois");
    expect(filtered.map((t) => t.id)).toEqual(["a"]);
  });

  it("excludes transactions with an invalid isoDate", () => {
    const { filterByPeriod } = useFinances();
    const list = [
      txn({ id: "a", isoDate: localIso(2026, 4, 15) }),
      txn({ id: "b", isoDate: "not-a-date" }),
    ];
    const filtered = filterByPeriod(list, "Mois");
    expect(filtered.map((t) => t.id)).toEqual(["a"]);
  });

  it("returns [] for an unknown period", () => {
    const { filterByPeriod } = useFinances();
    const list = [txn({ isoDate: localIso(2026, 4, 15) })];
    expect(filterByPeriod(list, "Inconnu")).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────
//  computeKpis
// ──────────────────────────────────────────────────────────────

describe("computeKpis", () => {
  it("computes caMonth from current-month revenues only", () => {
    const { computeKpis } = useFinances();
    const list = [
      txn({ amount: 100, isoDate: localIso(2026, 4, 10) }), // mai (courant)
      txn({ amount: 200, isoDate: localIso(2026, 3, 10) }), // avril
      txn({ amount: 300, isoDate: localIso(2025, 4, 10) }), // mai n-1
    ];
    const kpis = computeKpis(list);
    expect(kpis.caMonth).toBe(100);
  });

  it("computes caYear from all revenues of the current year", () => {
    const { computeKpis } = useFinances();
    const list = [
      txn({ amount: 100, isoDate: localIso(2026, 0, 10) }),
      txn({ amount: 200, isoDate: localIso(2026, 4, 10) }),
      txn({ amount: 999, isoDate: localIso(2025, 4, 10) }), // exclus
    ];
    const kpis = computeKpis(list);
    expect(kpis.caYear).toBe(300);
  });

  it("computes expense and benefit (caYear - expense)", () => {
    const { computeKpis } = useFinances();
    const list = [
      txn({ type: "revenu", amount: 1000, isoDate: localIso(2026, 0, 10) }),
      txn({ type: "depense", amount: 200, isoDate: localIso(2026, 1, 10) }),
      txn({ type: "depense", amount: 50, isoDate: localIso(2026, 4, 10) }),
    ];
    const kpis = computeKpis(list);
    expect(kpis.expense).toBe(250);
    expect(kpis.benefit).toBe(750);
    expect(kpis.margin).toBe(75);
  });

  it("computes paid / pending / pendingCount on invoices only", () => {
    const { computeKpis } = useFinances();
    const list = [
      invoiceTxn({
        amount: 500,
        paid: true,
        isoDate: localIso(2026, 2, 1),
      }),
      invoiceTxn({
        amount: 300,
        paid: false,
        isoDate: localIso(2026, 3, 1),
      }),
      invoiceTxn({
        amount: 200,
        paid: false,
        isoDate: localIso(2026, 4, 1),
      }),
      txn({ amount: 999, isoDate: localIso(2026, 4, 10) }), // manuel ignoré
    ];
    const kpis = computeKpis(list);
    expect(kpis.paid).toBe(500);
    expect(kpis.pending).toBe(500);
    expect(kpis.pendingCount).toBe(2);
  });

  it("returns 0 ratios (no NaN) when caYear is 0", () => {
    const { computeKpis } = useFinances();
    const kpis = computeKpis([]);
    expect(kpis.caYear).toBe(0);
    expect(kpis.margin).toBe(0);
    expect(kpis.paidRatio).toBe(0);
    expect(Number.isNaN(kpis.margin)).toBe(false);
  });

  it("computes paidRatio as paid invoices / CA (with manual revenue)", () => {
    const { computeKpis } = useFinances();
    const list = [
      invoiceTxn({ amount: 800, paid: true, isoDate: localIso(2026, 0, 1) }),
      invoiceTxn({ amount: 200, paid: false, isoDate: localIso(2026, 1, 1) }),
      txn({ amount: 200, isoDate: localIso(2026, 1, 5) }), // manuel
    ];
    const kpis = computeKpis(list);
    // caYear = factures payées (800) + revenus manuels (200) = 1000
    expect(kpis.caYear).toBe(1000);
    // paid = factures payées uniquement
    expect(kpis.paid).toBe(800);
    expect(kpis.paidRatio).toBe(80);
  });

  it("excludes pending invoices from caMonth and caYear", () => {
    const { computeKpis } = useFinances();
    const list = [
      invoiceTxn({ amount: 500, paid: true, isoDate: localIso(2026, 4, 1) }),
      invoiceTxn({ amount: 999, paid: false, isoDate: localIso(2026, 4, 10) }),
    ];
    const kpis = computeKpis(list);
    expect(kpis.caMonth).toBe(500);
    expect(kpis.caYear).toBe(500);
  });

  it("excludes pending invoices from benefit (paid invoice + manual − expense)", () => {
    const { computeKpis } = useFinances();
    const list = [
      invoiceTxn({ amount: 1000, paid: true, isoDate: localIso(2026, 0, 1) }),
      invoiceTxn({ amount: 500, paid: false, isoDate: localIso(2026, 1, 1) }),
      txn({ type: "depense", amount: 200, isoDate: localIso(2026, 2, 1) }),
    ];
    const kpis = computeKpis(list);
    expect(kpis.caYear).toBe(1000);
    expect(kpis.expense).toBe(200);
    expect(kpis.benefit).toBe(800);
  });

  it("still counts manual revenue in CA regardless of any 'paid' flag", () => {
    const { computeKpis } = useFinances();
    const list = [txn({ amount: 250, isoDate: localIso(2026, 4, 10) })];
    const kpis = computeKpis(list);
    expect(kpis.caMonth).toBe(250);
    expect(kpis.caYear).toBe(250);
  });
});

// ──────────────────────────────────────────────────────────────
//  computeMonthlySeries
// ──────────────────────────────────────────────────────────────

describe("computeMonthlySeries", () => {
  it("returns 12-slot arrays for revenue and expense", () => {
    const { computeMonthlySeries } = useFinances();
    const series = computeMonthlySeries([]);
    expect(series.revenue).toHaveLength(12);
    expect(series.expense).toHaveLength(12);
    expect(series.revenue.every((v) => v === 0)).toBe(true);
  });

  it("aggregates revenues by month for the current year", () => {
    const { computeMonthlySeries } = useFinances();
    const list = [
      txn({ amount: 100, isoDate: localIso(2026, 0, 5) }), // janvier
      txn({ amount: 200, isoDate: localIso(2026, 0, 20) }), // janvier
      txn({ amount: 300, isoDate: localIso(2026, 4, 1) }), // mai
    ];
    const { revenue } = computeMonthlySeries(list);
    expect(revenue[0]).toBe(300);
    expect(revenue[4]).toBe(300);
  });

  it("separates revenue and expense buckets", () => {
    const { computeMonthlySeries } = useFinances();
    const list = [
      txn({ type: "revenu", amount: 500, isoDate: localIso(2026, 4, 1) }),
      txn({ type: "depense", amount: 80, isoDate: localIso(2026, 4, 2) }),
    ];
    const { revenue, expense } = computeMonthlySeries(list);
    expect(revenue[4]).toBe(500);
    expect(expense[4]).toBe(80);
  });

  it("ignores transactions from other years", () => {
    const { computeMonthlySeries } = useFinances();
    const list = [
      txn({ amount: 999, isoDate: localIso(2025, 4, 1) }),
      txn({ amount: 100, isoDate: localIso(2026, 4, 1) }),
    ];
    const { revenue } = computeMonthlySeries(list);
    expect(revenue[4]).toBe(100);
  });

  it("excludes pending invoices from the revenue series", () => {
    const { computeMonthlySeries } = useFinances();
    const list = [
      invoiceTxn({ amount: 500, paid: true, isoDate: localIso(2026, 4, 1) }),
      invoiceTxn({ amount: 800, paid: false, isoDate: localIso(2026, 4, 10) }),
    ];
    const { revenue } = computeMonthlySeries(list);
    expect(revenue[4]).toBe(500);
  });
});

// ──────────────────────────────────────────────────────────────
//  computeRevenueBySource
// ──────────────────────────────────────────────────────────────

describe("computeRevenueBySource", () => {
  it("splits revenue between 'facture' and manual sources", () => {
    const { computeRevenueBySource } = useFinances();
    const list = [
      invoiceTxn({ amount: 700, isoDate: localIso(2026, 4, 1) }),
      txn({ amount: 300, isoDate: localIso(2026, 4, 1) }),
    ];
    const result = computeRevenueBySource(list);
    expect(result.total).toBe(1000);
    const invoiceSegment = result.segments.find((s) =>
      s.label.includes("Factures"),
    );
    const manualSegment = result.segments.find((s) =>
      s.label.includes("Particuliers"),
    );
    expect(invoiceSegment.value).toBe(700);
    expect(manualSegment.value).toBe(300);
  });

  it("ignores expenses (only counts revenues)", () => {
    const { computeRevenueBySource } = useFinances();
    const list = [
      txn({ type: "revenu", amount: 200 }),
      txn({ type: "depense", amount: 500 }),
    ];
    const result = computeRevenueBySource(list);
    expect(result.total).toBe(200);
  });

  it("returns 0 total on empty list", () => {
    const { computeRevenueBySource } = useFinances();
    const result = computeRevenueBySource([]);
    expect(result.total).toBe(0);
    expect(result.segments).toHaveLength(2);
  });

  it("excludes pending invoices from the breakdown", () => {
    const { computeRevenueBySource } = useFinances();
    const list = [
      invoiceTxn({ amount: 500, paid: true, isoDate: localIso(2026, 4, 1) }),
      invoiceTxn({ amount: 800, paid: false, isoDate: localIso(2026, 4, 10) }),
      txn({ amount: 200, isoDate: localIso(2026, 4, 15) }),
    ];
    const result = computeRevenueBySource(list);
    expect(result.total).toBe(700);
    const invoiceSeg = result.segments.find((s) =>
      s.label.includes("Factures"),
    );
    expect(invoiceSeg.value).toBe(500);
  });
});

// ──────────────────────────────────────────────────────────────
//  Date utility (isoToFr)
// ──────────────────────────────────────────────────────────────

describe("isoToFr", () => {
  it("formats an ISO string as DD/MM/YYYY", () => {
    const { isoToFr } = useFinances();
    // Use a noon ISO to be timezone-safe
    const iso = new Date(2026, 4, 15, 12).toISOString();
    expect(isoToFr(iso)).toBe("15/05/2026");
  });

  it("returns '' for invalid input", () => {
    const { isoToFr } = useFinances();
    expect(isoToFr("")).toBe("");
    expect(isoToFr(null)).toBe("");
    expect(isoToFr("not-a-date")).toBe("");
  });
});
