import { describe, it, expect, vi } from "vitest";

vi.mock("electron-log", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("electron", () => ({
  app: { getPath: () => "C:/tmp/facturation-test" },
}));

const { hydrateConfig, hydrateDocument } = await import("../utils/migrations.js");
const { DEFAULT_EINVOICE_PLATFORM, DEFAULT_CONFIG } = await import(
  "../utils/paths.js"
);

describe("hydrateConfig", () => {
  it("ajoute einvoicePlatform si absent", () => {
    const result = hydrateConfig({ company: { companyName: "ACME" } });
    expect(result.einvoicePlatform).toEqual(DEFAULT_EINVOICE_PLATFORM);
    expect(result.company.companyName).toBe("ACME");
  });

  it("conserve les valeurs déjà présentes dans einvoicePlatform", () => {
    const input = {
      einvoicePlatform: { providerName: "superpdp", urlApi: "https://x" },
    };
    const result = hydrateConfig(input);
    expect(result.einvoicePlatform.providerName).toBe("superpdp");
    expect(result.einvoicePlatform.urlApi).toBe("https://x");
    expect(result.einvoicePlatform.isSandbox).toBe(false);
    expect(result.einvoicePlatform.lastSyncedEventId).toBeNull();
  });

  it("remplace une valeur einvoicePlatform corrompue par les défauts", () => {
    const result = hydrateConfig({ einvoicePlatform: "garbage" });
    expect(result.einvoicePlatform).toEqual(DEFAULT_EINVOICE_PLATFORM);
  });

  it("ne mute pas l'objet source", () => {
    const input = { company: { name: "X" } };
    const result = hydrateConfig(input);
    expect(result).not.toBe(input);
    expect(input.einvoicePlatform).toBeUndefined();
  });

  it("retourne tel quel les entrées non-objet", () => {
    expect(hydrateConfig(null)).toBeNull();
    expect(hydrateConfig(undefined)).toBeUndefined();
  });

  it("complète les champs manquants des blocs company et billing", () => {
    // Config d'un ancien utilisateur (ex. 1.0.1) sans les champs ajoutés ensuite
    const oldConfig = {
      company: { companyName: "ACME", email: "a@b.fr" },
      billing: { paymentTerms: "Comptant" },
    };
    const result = hydrateConfig(oldConfig);

    // Valeurs existantes préservées
    expect(result.company.companyName).toBe("ACME");
    expect(result.company.email).toBe("a@b.fr");
    expect(result.billing.paymentTerms).toBe("Comptant");

    // Champs manquants comblés depuis les défauts
    expect(result.company.ownerName).toBe(DEFAULT_CONFIG.company.ownerName);
    expect(result.company.registeredAddress).toBe(
      DEFAULT_CONFIG.company.registeredAddress,
    );
    expect(result.billing.meansOfPayment).toBe(
      DEFAULT_CONFIG.billing.meansOfPayment,
    );
    expect(result.billing.pdfOutputPath).toBe(
      DEFAULT_CONFIG.billing.pdfOutputPath,
    );

    // Bloc entièrement absent ajouté
    expect(result.rib).toEqual(DEFAULT_CONFIG.rib);
    expect(result.einvoicePlatform).toEqual(DEFAULT_EINVOICE_PLATFORM);
  });

  it("préserve les valeurs falsy déjà saisies (0, false, '', null)", () => {
    const input = {
      billing: { latestInvoiceNumber: 0, paymentTerms: "" },
      einvoicePlatform: { isSandbox: false, lastSyncedEventId: null },
    };
    const result = hydrateConfig(input);

    expect(result.billing.latestInvoiceNumber).toBe(0);
    expect(result.billing.paymentTerms).toBe("");
    expect(result.einvoicePlatform.isSandbox).toBe(false);
    expect(result.einvoicePlatform.lastSyncedEventId).toBeNull();
  });

  it("ne mute aucun bloc imbriqué de la source", () => {
    const input = { company: { companyName: "X" } };
    const result = hydrateConfig(input);

    expect(result.company).not.toBe(input.company);
    expect(input.company.ownerName).toBeUndefined();
  });
});

describe("hydrateDocument", () => {
  function baseInvoice() {
    return {
      id: "F000001",
      type: "facture",
      numero: "F000001",
    };
  }

  it("ajoute le bloc einvoice à une facture qui n'en a pas", () => {
    const result = hydrateDocument("factures", baseInvoice());
    expect(result.einvoice).toEqual({
      isSent: false,
      dateSending: null,
      depositNumber: null,
      providerName: null,
      status: "draft",
      errors: [],
      lastEventId: null,
      statusLabel: null,
      lastEventAt: null,
    });
  });

  it("conserve le bloc einvoice existant", () => {
    const invoice = {
      ...baseInvoice(),
      einvoice: {
        isSent: true,
        dateSending: "2026-03-15T10:00:00Z",
        depositNumber: "DEP-42",
        providerName: "superpdp",
        status: "accepted",
        errors: [],
        lastEventId: 100,
      },
    };
    const result = hydrateDocument("factures", invoice);
    expect(result.einvoice.depositNumber).toBe("DEP-42");
    expect(result.einvoice.status).toBe("accepted");
  });

  it("ne touche pas aux devis", () => {
    const quote = { id: "D000001", type: "devis" };
    const result = hydrateDocument("devis", quote);
    expect(result.einvoice).toBeUndefined();
    expect(result).toBe(quote);
  });

  it("retourne tel quel un document null/undefined", () => {
    expect(hydrateDocument("factures", null)).toBeNull();
    expect(hydrateDocument("factures", undefined)).toBeUndefined();
  });
});
