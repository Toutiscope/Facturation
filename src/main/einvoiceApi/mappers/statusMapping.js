import { defaultEinvoice } from "../../validator.js";

/**
 * Mapping des status_code du cycle de vie SuperPDP / réforme française
 * vers les statuts métier de l'application.
 *
 * Statuts app : draft | submitted | accepted | rejected | paid | cancelled
 *
 * Codes vérifiés en sandbox : api:uploaded, fr:200, fr:201, fr:202, fr:212.
 * Pour les autres codes, on retombe sur une analyse du libellé (status_text)
 * renvoyé par l'API, plus robuste que de deviner chaque numéro.
 */
const CODE_MAP = {
  "api:uploaded": "submitted",
  "fr:200": "submitted", // Déposée (validée)
  "fr:201": "submitted", // Émise par la plateforme
  "fr:202": "submitted", // Reçue par la plateforme
  "fr:212": "paid", // Encaissée
};

/**
 * Mappe un événement vers un statut app, ou null si non concluant.
 * @param {Object} event - { status_code, status_text }
 * @returns {string|null}
 */
export function mapStatusEvent(event) {
  if (!event) return null;
  const code = event.status_code;
  if (code && CODE_MAP[code]) return CODE_MAP[code];

  const t = (event.status_text || "").toLowerCase();
  if (/encaiss|pay[ée]/.test(t)) return "paid";
  if (/refus|rejet/.test(t)) return "rejected";
  if (/annul/.test(t)) return "cancelled";
  if (/approuv|accept/.test(t)) return "accepted";
  return null;
}

/**
 * Applique une liste d'événements à une facture locale (fonction pure).
 * Met à jour le statut, le dernier id d'événement, le libellé et les erreurs.
 *
 * @param {Object} invoice - facture locale
 * @param {Array} events - événements concernant CETTE facture (même invoice_id)
 * @returns {Object} nouvelle facture (immuable côté entrée)
 */
export function applyEventsToInvoice(invoice, events) {
  if (!invoice || !Array.isArray(events) || events.length === 0) {
    return invoice;
  }

  const sorted = [...events].sort((a, b) => (a.id || 0) - (b.id || 0));
  const latest = sorted[sorted.length - 1];

  const einvoice = { ...(invoice.einvoice || defaultEinvoice()) };

  // Statut métier : dernier statut mappé (par ordre chronologique d'id)
  let mapped = null;
  for (const e of sorted) {
    const m = mapStatusEvent(e);
    if (m) mapped = m;
  }
  if (mapped) einvoice.status = mapped;

  einvoice.isSent = true;
  einvoice.lastEventId = latest.id ?? einvoice.lastEventId;
  einvoice.statusLabel = latest.status_text || einvoice.statusLabel || null;
  einvoice.lastEventAt = latest.created_at || einvoice.lastEventAt || null;

  if (mapped === "rejected") {
    einvoice.errors = [
      {
        code: latest.status_code || "PDP_REJECTED",
        message: latest.status_text || "Facture refusée par le destinataire",
        statusCode: latest.status_code,
        receivedAt: latest.created_at,
      },
    ];
  }

  return { ...invoice, einvoice };
}
