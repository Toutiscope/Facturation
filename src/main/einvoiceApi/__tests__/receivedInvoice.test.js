import { describe, it, expect } from "vitest";

const { normalizeReceived } = await import("../mappers/receivedInvoice.js");

describe("normalizeReceived", () => {
  function detail(overrides = {}) {
    return {
      id: 59136,
      created_at: "2026-05-26T20:15:23Z",
      en_invoice: {
        number: "F20260526",
        issue_date: "2026-05-20",
        currency_code: "EUR",
        seller: { name: "Burger Queen" },
        totals: {
          total_with_vat: "1863.79",
          amount_due_for_payment: "1863.79",
          total_vat_amount: { value: "303.33", currency_code: "EUR" },
        },
      },
      events: [
        { id: 1, status_code: "api:uploaded", status_text: "Téléversée" },
        {
          id: 3,
          status_code: "fr:202",
          status_text: "Reçue par la plateforme",
        },
        { id: 2, status_code: "fr:200", status_text: "Déposée" },
      ],
      ...overrides,
    };
  }

  it("extrait émetteur, numéro, date, montant et dernier statut", () => {
    const row = normalizeReceived(detail());
    expect(row.id).toBe(59136);
    expect(row.emitter).toBe("Burger Queen");
    expect(row.number).toBe("F20260526");
    expect(row.issueDate).toBe("2026-05-20");
    expect(row.amountTTC).toBe("1863.79");
    expect(row.currencyCode).toBe("EUR");
  });

  it("prend le dernier événement (par id) comme statut courant", () => {
    const row = normalizeReceived(detail());
    expect(row.statusCode).toBe("fr:202");
    expect(row.statusLabel).toBe("Reçue par la plateforme");
  });

  it("retombe sur amount_due_for_payment si total_with_vat absent", () => {
    const row = normalizeReceived(
      detail({
        en_invoice: {
          seller: { name: "X" },
          totals: { amount_due_for_payment: "500.00" },
        },
      }),
    );
    expect(row.amountTTC).toBe("500.00");
  });

  it("gère une facture sans en_invoice ni events", () => {
    const row = normalizeReceived({
      id: 1,
      created_at: "2026-01-01T00:00:00Z",
    });
    expect(row.emitter).toBe("—");
    expect(row.number).toBeNull();
    expect(row.amountTTC).toBeNull();
    expect(row.statusLabel).toBeNull();
  });
});
