import { describe, it, expect, vi } from "vitest";

// Mock electron-log (no-op)
vi.mock("electron-log", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { validateDocument } = await import("../validator.js");

// ── Helpers ──────────────────────────────────────────────────

function validQuote(overrides = {}) {
  return {
    id: "D000001",
    type: "devis",
    numero: "D000001",
    date: "15/01/2027",
    validityDate: "15/02/2027",
    status: "draft",
    customer: {
      customerName: "Client A",
      companyName: "Société A",
      companyId: "123 456 789 00012",
      address: "1 rue Test",
      postalCode: "44000",
      city: "Nantes",
      email: "a@test.fr",
      clientType: "professionnel",
    },
    services: [
      {
        id: 1,
        description: "Développement",
        quantity: 10,
        unit: "heure",
        unitPriceHT: 60,
        totalHT: 600,
      },
    ],
    totals: { totalHT: 600, VAT: 0, VATRate: 0, totalTTC: 600 },
    notes: "",
    createdAt: "2027-01-15T10:00:00Z",
    editedAt: "2027-01-15T10:00:00Z",
    ...overrides,
  };
}

function validInvoice(overrides = {}) {
  return {
    ...validQuote(),
    type: "facture",
    numero: "F000001",
    id: "F000001",
    dueDate: "15/02/2027",
    associatedQuote: "D000001",
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────
//  Valid documents
// ──────────────────────────────────────────────────────────────

describe("Validation — documents valides", () => {
  it("un devis valide passe la validation", () => {
    const result = validateDocument("devis", validQuote());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("une facture valide passe la validation", () => {
    const result = validateDocument("factures", validInvoice());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────
//  Missing fields (Zod schema)
// ──────────────────────────────────────────────────────────────

describe("Validation — champs manquants", () => {
  it("champs obligatoires manquants retournent des erreurs avec paths", () => {
    const doc = validQuote();
    delete doc.date;
    delete doc.customer.customerName;
    const result = validateDocument("devis", doc);
    expect(result.valid).toBe(false);

    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain("date");
    expect(paths).toContain("customer.customerName");
  });

  it("facture sans dueDate retourne une erreur", () => {
    const doc = validInvoice();
    delete doc.dueDate;
    const result = validateDocument("factures", doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "dueDate")).toBe(true);
  });

  it("aucun service retourne une erreur", () => {
    const doc = validQuote({ services: [] });
    const result = validateDocument("devis", doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "services")).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
//  Business rules
// ──────────────────────────────────────────────────────────────

describe("Validation — règles métier", () => {
  it("client professionnel sans SIRET retourne une erreur", () => {
    const doc = validQuote();
    doc.customer.clientType = "professionnel";
    doc.customer.companyId = "";
    const result = validateDocument("devis", doc);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path === "customer.companyId"),
    ).toBe(true);
  });

  it("client particulier sans SIRET passe", () => {
    const doc = validQuote();
    doc.customer.clientType = "particulier";
    doc.customer.companyId = "";
    const result = validateDocument("devis", doc);
    expect(result.valid).toBe(true);
  });

  it("incohérence totalHT ligne (qty × prix ≠ totalHT) → erreur", () => {
    const doc = validQuote();
    doc.services[0].totalHT = 999; // 10 * 60 = 600, not 999
    doc.totals.totalHT = 999;
    doc.totals.totalTTC = 999;
    const result = validateDocument("devis", doc);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path === "services.0.totalHT"),
    ).toBe(true);
  });

  it("incohérence totalHT global (somme services ≠ totals.totalHT) → erreur", () => {
    const doc = validQuote();
    doc.totals.totalHT = 1000; // services sum = 600
    doc.totals.totalTTC = 1000;
    const result = validateDocument("devis", doc);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path === "totals.totalHT"),
    ).toBe(true);
  });

  it("incohérence TTC (HT + TVA ≠ TTC) → erreur", () => {
    const doc = validQuote();
    doc.totals.VAT = 120;
    doc.totals.totalTTC = 600; // Should be 600 + 120 = 720
    const result = validateDocument("devis", doc);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path === "totals.totalTTC"),
    ).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
//  Format numéro
// ──────────────────────────────────────────────────────────────

describe("Validation — format numéro", () => {
  it("format numéro invalide pour devis → erreur", () => {
    const doc = validQuote({ numero: "X000001" });
    const result = validateDocument("devis", doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "numero")).toBe(true);
  });

  it("format numéro facture utilisé pour devis → erreur", () => {
    const doc = validQuote({ numero: "F000001" });
    const result = validateDocument("devis", doc);
    expect(result.valid).toBe(false);
  });

  it("format numéro avec 5 chiffres → erreur", () => {
    const doc = validQuote({ numero: "D00001" });
    const result = validateDocument("devis", doc);
    expect(result.valid).toBe(false);
  });

  it("format numéro facture invalide → erreur", () => {
    const doc = validInvoice({ numero: "D000001" });
    const result = validateDocument("factures", doc);
    expect(result.valid).toBe(false);
  });
});
