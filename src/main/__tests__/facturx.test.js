import { describe, it, expect, vi } from "vitest";

// Le PDF est généré localement (pdfkit) : on n'a besoin ni d'Electron ni d'une
// PDP. On neutralise juste les imports Electron d'`electron-log`/`electron`
// tirés par la chaîne pdfGenerator → fileManager → paths.
vi.mock("electron-log", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("electron", () => ({
  app: { getPath: () => "" },
  dialog: {},
  BrowserWindow: { getFocusedWindow: () => null },
}));

const { assembleFacturX } = await import("../facturxBuilder.js");

const INVOICE = {
  type: "facture",
  numero: "F000001",
  date: "15/01/2027",
  dueDate: "15/02/2027",
  object: "Prestation de test",
  customer: {
    customerName: "Client A",
    companyName: "Société A",
    address: "1 rue Test",
    postalCode: "44000",
    city: "Nantes",
    email: "a@test.fr",
    clientType: "professionnel",
    companyId: "12345678900012",
  },
  services: [
    { id: 1, description: "Dev", quantity: 10, unit: "heure", unitPriceHT: 60, totalHT: 600 },
  ],
  totals: { totalHT: 600, VAT: 0, VATRate: 0, totalTTC: 600 },
};

const CONFIG = {
  company: {
    companyName: "Acme",
    ownerName: "Jean Dupont",
    companyId: "55203453400017",
    address: "2 rue Exemple",
    postalCode: "75001",
    city: "Paris",
    email: "contact@acme.fr",
    phoneNumber: "0102030405",
  },
  billing: {
    legalNotice: "TVA non applicable, art. 293 B du CGI",
    paymentTerms: "Paiement à 30 jours",
    latePenalties: "Pénalités de retard applicables.",
  },
  rib: { iban: "FR7612345678901234567890123", bic: "ABCDEFGH", holder: "Acme" },
};

const CII_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
  <rsm:ExchangedDocument><ram:ID>F000001</ram:ID></rsm:ExchangedDocument>
</rsm:CrossIndustryInvoice>`;

describe("facturxBuilder / assembleFacturX", () => {
  it("produit un PDF avec le XMP Factur-X et le XML CII embarqué", async () => {
    const buffer = await assembleFacturX({
      document: INVOICE,
      config: CONFIG,
      ciiXml: CII_XML,
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    // En-tête PDF
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const content = buffer.toString("latin1");

    // Fichier XML embarqué sous le nom normalisé
    expect(content).toContain("factur-x.xml");
    // Métadonnées XMP Factur-X (namespace d'extension + profil de conformité)
    expect(content).toContain("urn:factur-x:pdfa:CrossIndustryDocument:invoice");
    expect(content).toContain("EN 16931");
    // Marqueur PDF/A (identifiant de conformité écrit par pdfkit)
    expect(content).toContain("pdfaid");
  });

  it("rejette un ciiXml manquant", async () => {
    await expect(
      assembleFacturX({ document: INVOICE, config: CONFIG, ciiXml: null }),
    ).rejects.toThrow(/ciiXml requis/i);
  });
});
