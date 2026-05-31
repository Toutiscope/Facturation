import { describe, it, expect } from "vitest";

const { buildUbl } = await import("../mappers/ubl.js");

function baseConfig(overrides = {}) {
  return {
    company: {
      companyName: "ACME Conseil",
      companyId: "81948462900015", // SIREN 819484629
      address: "12 rue des Lilas",
      postalCode: "44000",
      city: "Nantes",
      email: "vendeur@example.fr",
    },
    rib: { iban: "FR7612345678901234567890123", bic: "ABCDEFGH", holder: "Jean Dupont" },
    billing: {
      legalNotice: "Dispensé d'immatriculation au RCS et au RM.",
      paymentTerms: "Paiement à 30 jours",
      latePenalties: "Pénalités de retard : 10% par an.",
    },
    ...overrides,
  };
}

function baseInvoice(overrides = {}) {
  return {
    numero: "F000010",
    date: "26/05/2026",
    dueDate: "25/06/2026",
    customer: {
      customerName: "Jean Client",
      companyName: "ACME SARL",
      companyId: "55203453400017",
      address: "3 avenue Test",
      postalCode: "75001",
      city: "Paris",
      email: "client@acme.fr",
      clientType: "professionnel",
    },
    object: "Prestation de développement",
    services: [
      { id: 1, description: "Dév front-end", quantity: 10, unit: "heure", unitPriceHT: 65, totalHT: 650 },
      { id: 2, description: "Conseil", quantity: 1, unit: "forfait", unitPriceHT: 350, totalHT: 350 },
    ],
    totals: { totalHT: 1000, VAT: 0, VATRate: 0, totalTTC: 1000 },
    ...overrides,
  };
}

describe("buildUbl — structure de base", () => {
  it("génère un document Invoice UBL bien formé", () => {
    const xml = buildUbl(baseInvoice(), baseConfig());
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
    expect(xml).toContain("<cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>");
    expect(xml).toContain("<cbc:ProfileID>M1</cbc:ProfileID>");
    expect(xml).toContain("<cbc:ID>F000010</cbc:ID>");
    expect(xml).toContain("<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>");
    expect(xml.trim().endsWith("</Invoice>")).toBe(true);
  });

  it("convertit les dates dd/MM/yyyy en ISO", () => {
    const xml = buildUbl(baseInvoice(), baseConfig());
    expect(xml).toContain("<cbc:IssueDate>2026-05-26</cbc:IssueDate>");
    expect(xml).toContain("<cbc:DueDate>2026-06-25</cbc:DueDate>");
  });

  it("calcule le numéro de TVA français à partir du SIREN", () => {
    const xml = buildUbl(baseInvoice(), baseConfig());
    // SIREN 819484629 → clé (12 + 3*(819484629 mod 97)) mod 97
    expect(xml).toContain("<cbc:CompanyID>FR54819484629</cbc:CompanyID>");
  });
});

describe("buildUbl — mentions françaises obligatoires", () => {
  it("émet les notes codées #PMD#, #PMT#, #AAB#", () => {
    const xml = buildUbl(baseInvoice(), baseConfig());
    expect(xml).toContain("#PMD#");
    expect(xml).toContain("#PMT#");
    expect(xml).toContain("#AAB#");
  });
});

describe("buildUbl — TVA non applicable (293 B)", () => {
  it("utilise la catégorie E avec motif d'exonération au niveau document", () => {
    const xml = buildUbl(baseInvoice(), baseConfig());
    expect(xml).toContain("<cbc:TaxExemptionReason>TVA non applicable, art. 293 B du CGI</cbc:TaxExemptionReason>");
    expect(xml).toMatch(/<cac:TaxCategory><cbc:ID>E<\/cbc:ID>/);
  });

  it("n'inclut PAS de TaxExemptionReason au niveau ligne (UBL-CR-600/601)", () => {
    const xml = buildUbl(baseInvoice(), baseConfig());
    const lineSection = xml.slice(xml.indexOf("<cac:InvoiceLine>"));
    expect(lineSection).not.toContain("TaxExemptionReason");
  });

  it("TaxAmount global à 0.00", () => {
    const xml = buildUbl(baseInvoice(), baseConfig());
    expect(xml).toContain('<cac:TaxTotal><cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount>');
  });
});

describe("buildUbl — TVA standard", () => {
  it("utilise la catégorie S avec le taux quand VATRate > 0", () => {
    const xml = buildUbl(
      baseInvoice({ totals: { totalHT: 1000, VAT: 200, VATRate: 20, totalTTC: 1200 } }),
      baseConfig(),
    );
    expect(xml).toMatch(/<cac:TaxCategory><cbc:ID>S<\/cbc:ID><cbc:Percent>20<\/cbc:Percent>/);
    expect(xml).toContain('<cbc:TaxAmount currencyID="EUR">200.00</cbc:TaxAmount>');
    expect(xml).not.toContain("TaxExemptionReason");
  });
});

describe("buildUbl — lignes et totaux", () => {
  it("génère une InvoiceLine par prestation avec unitCode mappé", () => {
    const xml = buildUbl(baseInvoice(), baseConfig());
    expect((xml.match(/<cac:InvoiceLine>/g) || []).length).toBe(2);
    expect(xml).toContain('unitCode="HUR"');
    expect(xml).toContain('unitCode="C62"');
  });

  it("formate les montants à 2 décimales", () => {
    const xml = buildUbl(baseInvoice(), baseConfig());
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="EUR">650.00</cbc:LineExtensionAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">1000.00</cbc:PayableAmount>');
  });

  it("inclut le RIB dans PaymentMeans si IBAN présent", () => {
    const xml = buildUbl(baseInvoice(), baseConfig());
    expect(xml).toContain("<cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>");
    expect(xml).toContain("<cbc:ID>FR7612345678901234567890123</cbc:ID>");
  });

  it("omet PaymentMeans si pas d'IBAN", () => {
    const xml = buildUbl(baseInvoice(), baseConfig({ rib: { iban: "", bic: "", holder: "" } }));
    expect(xml).not.toContain("<cac:PaymentMeans>");
  });
});

describe("buildUbl — endpoints de routage", () => {
  it("déduit l'EndpointID du SIREN avec le scheme 0225 par défaut", () => {
    const xml = buildUbl(baseInvoice(), baseConfig());
    expect(xml).toContain('<cbc:EndpointID schemeID="0225">819484629</cbc:EndpointID>');
    expect(xml).toContain('<cbc:EndpointID schemeID="0225">552034534</cbc:EndpointID>');
  });

  it("accepte un endpoint objet { value, scheme }", () => {
    const xml = buildUbl(baseInvoice(), baseConfig(), {
      sellerEndpoint: { value: "315143296_8899", scheme: "0225" },
      buyerEndpoint: { value: "315143296_8898", scheme: "0225" },
    });
    expect(xml).toContain('<cbc:EndpointID schemeID="0225">315143296_8899</cbc:EndpointID>');
    expect(xml).toContain('<cbc:EndpointID schemeID="0225">315143296_8898</cbc:EndpointID>');
  });

  it("accepte un endpoint chaîne 'scheme:value'", () => {
    const xml = buildUbl(baseInvoice(), baseConfig(), {
      buyerEndpoint: "0088:1234567890123",
    });
    expect(xml).toContain('<cbc:EndpointID schemeID="0088">1234567890123</cbc:EndpointID>');
  });
});

describe("buildUbl — échappement XML", () => {
  it("échappe les caractères spéciaux dans les champs texte", () => {
    const xml = buildUbl(
      baseInvoice({
        services: [
          { id: 1, description: "Audit R&D <stratégie>", quantity: 1, unit: "forfait", unitPriceHT: 100, totalHT: 100 },
        ],
        totals: { totalHT: 100, VAT: 0, VATRate: 0, totalTTC: 100 },
      }),
      baseConfig(),
    );
    expect(xml).toContain("Audit R&amp;D &lt;stratégie&gt;");
  });
});

describe("buildUbl — garde-fous", () => {
  it("lève si invoice absent", () => {
    expect(() => buildUbl(null, baseConfig())).toThrow(/invoice/);
  });
  it("lève si config.company absent", () => {
    expect(() => buildUbl(baseInvoice(), {})).toThrow(/company/);
  });
  it("lève si date invalide", () => {
    expect(() => buildUbl(baseInvoice({ date: "pas-une-date" }), baseConfig())).toThrow(/Date invalide/);
  });
});
