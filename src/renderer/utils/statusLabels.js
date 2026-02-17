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
