/**
 * Générateur UBL 2.1 (profil France EN16931) à partir d'une facture locale.
 *
 * SuperPDP n'ingère que du XML (UBL/CII) ou du Factur-X — pas de JSON.
 * On génère donc directement de l'UBL, validé contre le schematron via
 * POST /validation_reports.
 *
 * Cas couverts : prestation de services Entrepreneur Individuel,
 * TVA non applicable (art. 293 B du CGI, catégorie « E ») ou taux standard
 * (catégorie « S »).
 */

const CUSTOMIZATION_ID = "urn:cen.eu:en16931:2017";
const PROFILE_ID = "M1";
const TYPE_CODE_INVOICE = "380";
const COUNTRY = "FR";
const CURRENCY = "EUR";

// Schemes ISO 6523 / EAS utilisés pour la France
const SCHEME_ENDPOINT = "0225"; // FR SIRENE (adresse électronique)
const SCHEME_SIREN = "0002"; // SIRENE (immatriculation légale)

const VATEX_293B_TEXT = "TVA non applicable, art. 293 B du CGI";

/**
 * @param {Object} invoice - facture locale (cf. CLAUDE.md)
 * @param {Object} config - configuration utilisateur
 * @param {Object} [opts] - { sellerEndpoint, buyerEndpoint } : adresses de routage
 *   sous forme { value, scheme } ou chaîne "scheme:value". Si absent, l'endpoint
 *   est déduit du SIREN avec le scheme 0225.
 * @returns {string} UBL XML
 */
export function buildUbl(invoice, config, opts = {}) {
  if (!invoice) throw new Error("invoice requis pour générer l'UBL");
  if (!config || !config.company) throw new Error("config.company requis");

  const isVat = isVatActive(invoice);
  const lines = invoice.services || [];

  const xml = [];
  xml.push('<?xml version="1.0" encoding="UTF-8"?>');
  xml.push(
    '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"' +
      ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"' +
      ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">',
  );

  xml.push(el("cbc:CustomizationID", CUSTOMIZATION_ID));
  xml.push(el("cbc:ProfileID", PROFILE_ID));
  xml.push(el("cbc:ID", invoice.numero));
  xml.push(el("cbc:IssueDate", toIsoDate(invoice.date)));
  if (invoice.dueDate) xml.push(el("cbc:DueDate", toIsoDate(invoice.dueDate)));
  xml.push(el("cbc:InvoiceTypeCode", TYPE_CODE_INVOICE));

  for (const note of buildNotes(invoice, config)) {
    xml.push(el("cbc:Note", note));
  }

  xml.push(el("cbc:DocumentCurrencyCode", CURRENCY));

  if (invoice.associatedQuote) {
    xml.push(tag("cac:OrderReference", el("cbc:ID", invoice.associatedQuote)));
  }

  // ── Vendeur ──
  // BR-E-02 / BR-S : le vendeur doit toujours porter un identifiant TVA (BT-31).
  // Le n° de TVA intracommunautaire FR est dérivable du SIREN.
  xml.push(
    tag(
      "cac:AccountingSupplierParty",
      buildParty({
        name: config.company.companyName,
        siren: siren(config.company.companyId),
        vatId: frenchVatId(config.company.companyId),
        address: config.company.address,
        postalCode: config.company.postalCode,
        city: config.company.city,
        email: config.company.email,
        endpoint: normalizeEndpoint(
          opts.sellerEndpoint,
          siren(config.company.companyId),
        ),
      }),
    ),
  );

  // ── Acheteur ──
  const c = invoice.customer || {};
  xml.push(
    tag(
      "cac:AccountingCustomerParty",
      buildParty({
        name: c.companyName || c.customerName,
        siren: siren(c.companyId),
        vatId: null,
        address: c.address,
        postalCode: c.postalCode,
        city: c.city,
        email: c.email,
        endpoint: normalizeEndpoint(opts.buyerEndpoint, siren(c.companyId)),
      }),
    ),
  );

  // ── Moyens de paiement (RIB) ──
  if (config.rib && config.rib.iban) {
    xml.push(
      tag(
        "cac:PaymentMeans",
        el("cbc:PaymentMeansCode", "30"), // virement
        tag(
          "cac:PayeeFinancialAccount",
          el("cbc:ID", strip(config.rib.iban)),
          config.rib.holder ? el("cbc:Name", config.rib.holder) : "",
        ),
      ),
    );
  }

  if (config.billing && config.billing.paymentTerms) {
    xml.push(
      tag("cac:PaymentTerms", el("cbc:Note", config.billing.paymentTerms)),
    );
  }

  // ── TVA ──
  xml.push(buildTaxTotal(invoice, isVat));

  // ── Totaux monétaires ──
  const t = invoice.totals || {};
  xml.push(
    tag(
      "cac:LegalMonetaryTotal",
      amtEl("cbc:LineExtensionAmount", t.totalHT),
      amtEl("cbc:TaxExclusiveAmount", t.totalHT),
      amtEl("cbc:TaxInclusiveAmount", t.totalTTC),
      amtEl("cbc:PayableAmount", t.totalTTC),
    ),
  );

  // ── Lignes ──
  lines.forEach((line, i) => {
    xml.push(buildLine(line, i, isVat, invoice));
  });

  xml.push("</Invoice>");
  return xml.join("\n");
}

// ============================================================
// Parties
// ============================================================

function buildParty(p) {
  const parts = [];
  parts.push(
    el("cbc:EndpointID", p.endpoint.value, { schemeID: p.endpoint.scheme }),
  );
  if (p.siren) {
    parts.push(
      tag(
        "cac:PartyIdentification",
        el("cbc:ID", p.siren, { schemeID: SCHEME_ENDPOINT }),
      ),
    );
  }

  const addr = [];
  if (p.address) addr.push(el("cbc:StreetName", p.address));
  if (p.city) addr.push(el("cbc:CityName", p.city));
  if (p.postalCode) addr.push(el("cbc:PostalZone", p.postalCode));
  addr.push(tag("cac:Country", el("cbc:IdentificationCode", COUNTRY)));
  parts.push(tag("cac:PostalAddress", ...addr));

  // BT-31 : identifiant TVA (obligatoire pour le vendeur sur facture exonérée ou taxée)
  if (p.vatId) {
    parts.push(
      tag(
        "cac:PartyTaxScheme",
        el("cbc:CompanyID", p.vatId),
        tag("cac:TaxScheme", el("cbc:ID", "VAT")),
      ),
    );
  }

  const legal = [el("cbc:RegistrationName", p.name)];
  if (p.siren) {
    legal.push(el("cbc:CompanyID", p.siren, { schemeID: SCHEME_SIREN }));
  }
  parts.push(tag("cac:PartyLegalEntity", ...legal));

  if (p.email) {
    parts.push(tag("cac:Contact", el("cbc:ElectronicMail", p.email)));
  }

  return tag("cac:Party", ...parts);
}

// ============================================================
// TVA
// ============================================================

function buildTaxTotal(invoice, isVat) {
  const t = invoice.totals || {};

  if (!isVat) {
    // Exemption (293 B) : catégorie E, taux 0, motif obligatoire
    return tag(
      "cac:TaxTotal",
      amtEl("cbc:TaxAmount", 0),
      tag(
        "cac:TaxSubtotal",
        amtEl("cbc:TaxableAmount", t.totalHT),
        amtEl("cbc:TaxAmount", 0),
        tag(
          "cac:TaxCategory",
          el("cbc:ID", "E"),
          el("cbc:Percent", "0"),
          el("cbc:TaxExemptionReason", VATEX_293B_TEXT),
          tag("cac:TaxScheme", el("cbc:ID", "VAT")),
        ),
      ),
    );
  }

  // TVA standard : un sous-total par taux
  const rate = num(t.VATRate);
  return tag(
    "cac:TaxTotal",
    amtEl("cbc:TaxAmount", t.VAT),
    tag(
      "cac:TaxSubtotal",
      amtEl("cbc:TaxableAmount", t.totalHT),
      amtEl("cbc:TaxAmount", t.VAT),
      tag(
        "cac:TaxCategory",
        el("cbc:ID", "S"),
        el("cbc:Percent", trimRate(rate)),
        tag("cac:TaxScheme", el("cbc:ID", "VAT")),
      ),
    ),
  );
}

// ============================================================
// Lignes
// ============================================================

function buildLine(line, index, isVat, invoice) {
  const rate = isVat ? num(invoice.totals.VATRate) : 0;
  const category = isVat ? "S" : "E";

  const item = [];
  if (line.description && line.description !== line.label) {
    item.push(el("cbc:Description", line.description));
  }
  item.push(el("cbc:Name", line.description || `Ligne ${index + 1}`));

  // UBL-CR-600/601 : pas de TaxExemptionReason* au niveau ligne (seulement au document)
  const taxCat = [
    el("cbc:ID", category),
    el("cbc:Percent", trimRate(rate)),
    tag("cac:TaxScheme", el("cbc:ID", "VAT")),
  ];
  item.push(tag("cac:ClassifiedTaxCategory", ...taxCat));

  return tag(
    "cac:InvoiceLine",
    el("cbc:ID", String(line.id ?? index + 1)),
    el("cbc:InvoicedQuantity", num(line.quantity), {
      unitCode: mapUnit(line.unit),
    }),
    amtEl("cbc:LineExtensionAmount", line.totalHT),
    tag("cac:Item", ...item),
    tag("cac:Price", amtEl("cbc:PriceAmount", line.unitPriceHT)),
  );
}

// ============================================================
// Notes
// ============================================================

function buildNotes(invoice, config) {
  const notes = [];
  const billing = config.billing || {};

  // Mentions françaises obligatoires (BR-FR-05), codées #PMD# / #PMT# / #AAB#
  notes.push(
    "#PMD#" +
      (billing.latePenalties ||
        "À défaut de règlement à la date d’échéance, une pénalité de retard sera applicable."),
  );
  notes.push(
    "#PMT#L’indemnité forfaitaire légale pour frais de recouvrement est de 40 €.",
  );
  notes.push(
    "#AAB#" +
      (billing.discountTerms || "Aucun escompte pour paiement anticipé."),
  );

  if (billing.legalNotice) notes.push(billing.legalNotice);
  if (invoice.object) notes.push(invoice.object);
  return notes;
}

// ============================================================
// Helpers XML
// ============================================================

function el(name, value, attrs) {
  const a = attrs ? attrString(attrs) : "";
  return `<${name}${a}>${escapeXml(value)}</${name}>`;
}

function amtEl(name, value) {
  return `<${name} currencyID="${CURRENCY}">${amount(value)}</${name}>`;
}

function tag(name, ...children) {
  const inner = children.filter(Boolean).join("");
  return `<${name}>${inner}</${name}>`;
}

function attrString(attrs) {
  return Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join("");
}

function escapeXml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================================
// Helpers métier
// ============================================================

function isVatActive(invoice) {
  const rate = num(invoice.totals && invoice.totals.VATRate);
  const vat = num(invoice.totals && invoice.totals.VAT);
  return rate > 0 && vat > 0;
}

function amount(value) {
  const n = num(value);
  return n.toFixed(2);
}

function num(v) {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function trimRate(rate) {
  // EN16931 : pourcentage sans zéros superflus mais avec au moins une décimale tolérée
  return String(num(rate));
}

function strip(s) {
  return String(s || "").replace(/\s+/g, "");
}

function siren(companyId) {
  const digits = strip(companyId).replace(/\D/g, "");
  return digits.slice(0, 9);
}

/**
 * Normalise une adresse de routage en { value, scheme }.
 * Accepte un objet { value, scheme }, une chaîne "scheme:value", ou rien
 * (auquel cas on retombe sur le SIREN avec le scheme par défaut).
 */
function normalizeEndpoint(endpoint, fallbackValue) {
  if (endpoint && typeof endpoint === "object" && endpoint.value) {
    return {
      value: endpoint.value,
      scheme: endpoint.scheme || SCHEME_ENDPOINT,
    };
  }
  if (typeof endpoint === "string" && endpoint) {
    const idx = endpoint.indexOf(":");
    if (idx !== -1) {
      return { scheme: endpoint.slice(0, idx), value: endpoint.slice(idx + 1) };
    }
    return { value: endpoint, scheme: SCHEME_ENDPOINT };
  }
  return { value: fallbackValue, scheme: SCHEME_ENDPOINT };
}

function frenchVatId(companyId) {
  // Numéro de TVA intracommunautaire FR = FR + clé(2 chiffres) + SIREN.
  // clé = (12 + 3 * (SIREN mod 97)) mod 97
  const s = siren(companyId);
  if (s.length !== 9) return null;
  const sirenNum = Number(s);
  if (Number.isNaN(sirenNum)) return null;
  const key = (12 + 3 * (sirenNum % 97)) % 97;
  return `FR${String(key).padStart(2, "0")}${s}`;
}

function mapUnit(unit) {
  switch (unit) {
    case "heure":
      return "HUR";
    case "jour":
      return "DAY";
    case "forfait":
      return "C62";
    case "pièce":
    case "piece":
    default:
      return "C62";
  }
}

function toIsoDate(input) {
  if (!input) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 10);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error(`Date invalide : ${input}`);
  return d.toISOString().slice(0, 10);
}
