/**
 * Normalise le détail d'une facture (réponse GET /invoices/{id}) en une ligne
 * d'affichage pour la vue « Factures reçues ».
 *
 * @param {Object} inv - facture détaillée (avec en_invoice + events)
 * @returns {Object} ligne normalisée
 */
export function normalizeReceived(inv) {
  const en = (inv && inv.en_invoice) || {};
  const totals = en.totals || {};
  const events = [...((inv && inv.events) || [])].sort(
    (a, b) => (a.id || 0) - (b.id || 0),
  );
  const latest = events[events.length - 1];

  return {
    id: inv && inv.id,
    createdAt: inv && inv.created_at,
    emitter: (en.seller && en.seller.name) || "—",
    number: en.number || null,
    issueDate: en.issue_date || null,
    amountTTC:
      totals.total_with_vat != null
        ? totals.total_with_vat
        : totals.amount_due_for_payment || null,
    currencyCode:
      (totals.total_vat_amount && totals.total_vat_amount.currency_code) ||
      en.currency_code ||
      "EUR",
    statusCode: latest ? latest.status_code : null,
    statusLabel: latest ? latest.status_text : null,
  };
}
