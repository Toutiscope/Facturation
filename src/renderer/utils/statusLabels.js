export const STATUS_LABELS = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  refused: "Refusé",
  paid: "Payé",
  overdue: "En retard",
  rejected: "Rejeté",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

// ── Statuts e-invoice (cycle de vie PDP) ─────────────────────
export const EINVOICE_STATUS_LABELS = {
  draft: "Non envoyée",
  submitted: "Transmise",
  accepted: "Acceptée",
  rejected: "Rejetée",
  paid: "Encaissée",
  cancelled: "Annulée",
};

export function einvoiceStatusLabel(status) {
  return EINVOICE_STATUS_LABELS[status] || "Non envoyée";
}
