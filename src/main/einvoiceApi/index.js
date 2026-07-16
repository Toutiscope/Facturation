import { createSuperPdpAdapter } from "./adapters/superpdp.js";
import { buildUbl } from "./mappers/ubl.js";
import { normalizeReceived } from "./mappers/receivedInvoice.js";

const ADAPTER_FACTORIES = {
  superpdp: createSuperPdpAdapter,
};

let cachedAdapter = null;
let cachedProviderKey = null;

/**
 * Récupère (et met en cache) l'adapter PDP pour la configuration courante.
 *
 * @param {Object} config - configuration complète chargée depuis fileManager.loadConfig()
 * @returns {Object} adapter
 */
export function getAdapter(config) {
  const platform = config && config.einvoicePlatform;
  if (!platform || !platform.providerName) {
    throw new Error(
      "Aucune plateforme PDP n'est configurée. Ouvrir Paramètres pour en sélectionner une.",
    );
  }

  const factory = ADAPTER_FACTORIES[platform.providerName];
  if (!factory) {
    throw new Error(`PDP non supportée : ${platform.providerName}`);
  }

  const key = `${platform.providerName}:${platform.urlApi || ""}:${platform.isSandbox ? "sandbox" : "prod"}`;
  if (cachedAdapter && cachedProviderKey === key) {
    return cachedAdapter;
  }

  cachedAdapter = factory(platform);
  cachedProviderKey = key;
  return cachedAdapter;
}

/**
 * À appeler quand la configuration ou les credentials changent pour forcer la recréation
 * de l'adapter au prochain appel.
 */
export function resetAdapterCache() {
  if (
    cachedAdapter &&
    typeof cachedAdapter.invalidateTokenCache === "function"
  ) {
    cachedAdapter.invalidateTokenCache();
  }
  cachedAdapter = null;
  cachedProviderKey = null;
}

// ============================================================
// Surface publique stable pour les IPC handlers
// ============================================================

export async function testConnection(config) {
  return getAdapter(config).testConnection();
}

export async function getSessionStatus(config) {
  return getAdapter(config).getSessionStatus();
}

/**
 * Envoie une facture locale (JSON Facturation) à la PDP.
 * Pipeline : génération UBL → POST /invoices (corps brut XML).
 *
 * SuperPDP n'ingère que du XML/PDF (pas de JSON), d'où la génération UBL
 * directe plutôt qu'un passage par /convert.
 *
 * @param {Object} config
 * @param {Object} invoice - facture au format local (cf. CLAUDE.md)
 * @param {Object} options - { disablePreCheck, ublOptions }
 * @returns {Promise<Object>} { depositId, raw }
 */
export async function sendInvoice(config, invoice, options = {}) {
  const adapter = getAdapter(config);

  // Adresse de routage du vendeur (entreprise authentifiée)
  const sellerEndpoint = await adapter.getOwnEndpoint();

  // Adresse de routage du destinataire :
  //   1) override explicite (customer.electronicAddress, ou options.buyerEndpoint)
  //   2) résolution via l'annuaire DGFiP par SIREN
  //   3) sinon erreur claire
  const customer = invoice.customer || {};
  let buyerEndpoint =
    options.buyerEndpoint || customer.electronicAddress || null;

  if (!buyerEndpoint) {
    const buyerSiren = String(customer.companyId || "")
      .replace(/\D/g, "")
      .slice(0, 9);

    if (buyerSiren.length !== 9) {
      throw recipientError(
        "SIREN du destinataire manquant ou invalide, et aucune adresse électronique PDP renseignée.",
      );
    }

    const recipient = await adapter.resolveRecipient(buyerSiren);
    if (!recipient.found) {
      throw recipientError(
        "Destinataire introuvable dans l'annuaire de la facturation électronique. " +
          "Renseignez son adresse électronique PDP manuellement.",
      );
    }
    if (!recipient.isActive || !recipient.endpoint) {
      throw recipientError(
        "Le destinataire est référencé dans l'annuaire mais n'est pas encore " +
          "actif pour recevoir des factures électroniques.",
      );
    }
    buyerEndpoint = recipient.endpoint;
  }

  const ubl = buildUbl(invoice, config, {
    sellerEndpoint,
    buyerEndpoint,
    ...(options.ublOptions || {}),
  });

  const created = await adapter.sendInvoice(ubl, {
    contentType: "application/xml",
    disablePreCheck: options.disablePreCheck,
  });

  return { depositId: created.id, raw: created };
}

function recipientError(message) {
  const err = new Error(message);
  err.code = "PDP_RECIPIENT";
  return err;
}

/**
 * Produit un Factur-X (PDF/A-3 + XML CII embarqué) à partir d'une facture locale.
 * Pipeline : génération UBL → POST /invoices/convert?from=ubl&to=factur-x.
 *
 * Les adresses de routage sont déduites du SIREN (pas d'appel à l'annuaire) :
 * cet export vise l'archivage lisible / le partage manuel, pas le dépôt PDP.
 * Une facture non conforme au schematron (ex. client particulier sans SIREN)
 * sera rejetée par la conversion — l'erreur est alors remontée telle quelle.
 *
 * @param {Object} config
 * @param {Object} invoice - facture au format local (cf. CLAUDE.md)
 * @param {Object} [options] - { ublOptions }
 * @returns {Promise<Buffer>} PDF Factur-X
 */
export async function exportFacturX(config, invoice, options = {}) {
  const ubl = buildUbl(invoice, config, options.ublOptions || {});
  return convertDocument(config, ubl, {
    from: "ubl",
    to: "factur-x",
    contentType: "application/xml",
  });
}

export async function validateInvoiceFile(config, file, fileName) {
  return getAdapter(config).validateInvoice(file, fileName);
}

export async function fetchInvoices(config, opts) {
  return getAdapter(config).fetchInvoices(opts);
}

export async function getInvoice(config, id) {
  return getAdapter(config).getInvoice(id);
}

export async function downloadInvoice(config, id, opts) {
  return getAdapter(config).downloadInvoice(id, opts);
}

/**
 * Récupère les factures reçues, enrichies pour l'affichage.
 * La liste /invoices ne contient que des identifiants : on récupère le détail
 * de chaque facture (en_invoice + events) pour construire les lignes.
 *
 * @param {Object} config
 * @param {Object} opts - { limit, startingAfterId }
 * @returns {Promise<{ rows: Array, hasAfter: boolean, count: number }>}
 */
export async function fetchReceivedInvoices(
  config,
  { limit = 20, startingAfterId } = {},
) {
  const adapter = getAdapter(config);
  const list = await adapter.fetchInvoices({
    direction: "in",
    order: "desc",
    limit,
    startingAfterId,
  });
  const items = list.data || [];

  const rows = await Promise.all(
    items.map(async (item) => {
      try {
        const inv = await adapter.getInvoice(item.id);
        return normalizeReceived(inv);
      } catch (err) {
        return {
          id: item.id,
          createdAt: item.created_at,
          error: err.message || "Détail indisponible",
        };
      }
    }),
  );

  return {
    rows,
    hasAfter: Boolean(list.has_after),
    count: list.count,
  };
}

export async function listEvents(config, opts) {
  return getAdapter(config).listEvents(opts);
}

export async function createEvent(config, payload) {
  return getAdapter(config).createEvent(payload);
}

export async function searchFrenchDirectory(config, siren) {
  return getAdapter(config).searchFrenchDirectory(siren);
}

/**
 * Résout l'adresse électronique de routage d'un destinataire via l'annuaire DGFiP.
 * @param {Object} config
 * @param {string} siren
 * @returns {Promise<{ found: boolean, isActive: boolean, endpoint: {value,scheme}|null, name?: string }>}
 */
export async function resolveRecipient(config, siren) {
  return getAdapter(config).resolveRecipient(siren);
}

/**
 * Convertit un document entre formats XML/PDF (ubl, cii, factur-x).
 * Utile pour produire un Factur-X d'archivage à partir de l'UBL.
 *
 * @param {Object} config
 * @param {string|Buffer} payload - document source
 * @param {Object} opts - { from, to, contentType }
 */
export async function convertDocument(config, payload, opts) {
  return getAdapter(config).convertInvoice(payload, opts);
}
