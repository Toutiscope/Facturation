import { describe, it, expect, vi } from "vitest";

vi.mock("electron-log", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { mapStatusEvent, applyEventsToInvoice } = await import(
  "../mappers/statusMapping.js"
);

describe("mapStatusEvent", () => {
  it("mappe les codes vérifiés", () => {
    expect(mapStatusEvent({ status_code: "api:uploaded" })).toBe("submitted");
    expect(mapStatusEvent({ status_code: "fr:200" })).toBe("submitted");
    expect(mapStatusEvent({ status_code: "fr:201" })).toBe("submitted");
    expect(mapStatusEvent({ status_code: "fr:202" })).toBe("submitted");
    expect(mapStatusEvent({ status_code: "fr:212" })).toBe("paid");
  });

  it("retombe sur l'analyse du libellé pour les codes inconnus", () => {
    expect(mapStatusEvent({ status_code: "fr:205", status_text: "Approuvée" })).toBe("accepted");
    expect(mapStatusEvent({ status_code: "fr:210", status_text: "Refusée" })).toBe("rejected");
    expect(mapStatusEvent({ status_code: "fr:299", status_text: "Encaissée partiellement" })).toBe("paid");
    expect(mapStatusEvent({ status_code: "x", status_text: "Annulée" })).toBe("cancelled");
  });

  it("retourne null si rien de concluant", () => {
    expect(mapStatusEvent({ status_code: "fr:207", status_text: "En litige" })).toBeNull();
    expect(mapStatusEvent(null)).toBeNull();
    expect(mapStatusEvent({})).toBeNull();
  });
});

describe("applyEventsToInvoice", () => {
  function invoice() {
    return {
      id: "F000001",
      numero: "F000001",
      einvoice: {
        isSent: true,
        dateSending: "2026-05-26T10:00:00Z",
        depositNumber: "59136",
        providerName: "superpdp",
        status: "submitted",
        errors: [],
        lastEventId: 100,
        statusLabel: null,
        lastEventAt: null,
      },
    };
  }

  it("applique le dernier statut mappé par ordre chronologique", () => {
    const events = [
      { id: 101, invoice_id: 59136, status_code: "fr:200", status_text: "Déposée", created_at: "2026-05-26T10:01:00Z" },
      { id: 103, invoice_id: 59136, status_code: "fr:212", status_text: "Encaissée", created_at: "2026-05-26T10:03:00Z" },
      { id: 102, invoice_id: 59136, status_code: "fr:202", status_text: "Reçue", created_at: "2026-05-26T10:02:00Z" },
    ];
    const result = applyEventsToInvoice(invoice(), events);
    expect(result.einvoice.status).toBe("paid");
    expect(result.einvoice.lastEventId).toBe(103);
    expect(result.einvoice.statusLabel).toBe("Encaissée");
    expect(result.einvoice.lastEventAt).toBe("2026-05-26T10:03:00Z");
  });

  it("enregistre une erreur quand la facture est refusée", () => {
    const events = [
      { id: 110, invoice_id: 59136, status_code: "fr:210", status_text: "Refusée par le destinataire", created_at: "2026-05-26T11:00:00Z" },
    ];
    const result = applyEventsToInvoice(invoice(), events);
    expect(result.einvoice.status).toBe("rejected");
    expect(result.einvoice.errors).toHaveLength(1);
    expect(result.einvoice.errors[0].message).toMatch(/Refusée/);
    expect(result.einvoice.errors[0].statusCode).toBe("fr:210");
  });

  it("conserve le statut courant si aucun événement n'est concluant", () => {
    const events = [
      { id: 105, invoice_id: 59136, status_code: "fr:207", status_text: "En litige", created_at: "2026-05-26T10:05:00Z" },
    ];
    const result = applyEventsToInvoice(invoice(), events);
    expect(result.einvoice.status).toBe("submitted"); // inchangé
    expect(result.einvoice.lastEventId).toBe(105); // mais l'avancement est suivi
    expect(result.einvoice.statusLabel).toBe("En litige");
  });

  it("ne mute pas la facture source", () => {
    const inv = invoice();
    const events = [{ id: 200, invoice_id: 59136, status_code: "fr:212", status_text: "Encaissée" }];
    const result = applyEventsToInvoice(inv, events);
    expect(result).not.toBe(inv);
    expect(inv.einvoice.status).toBe("submitted");
  });

  it("retourne la facture inchangée si pas d'événements", () => {
    const inv = invoice();
    expect(applyEventsToInvoice(inv, [])).toBe(inv);
    expect(applyEventsToInvoice(inv, null)).toBe(inv);
  });

  it("initialise un bloc einvoice si absent", () => {
    const bare = { id: "F000002", numero: "F000002" };
    const events = [{ id: 1, invoice_id: 1, status_code: "fr:212", status_text: "Encaissée", created_at: "2026-05-26T12:00:00Z" }];
    const result = applyEventsToInvoice(bare, events);
    expect(result.einvoice.status).toBe("paid");
    expect(result.einvoice.isSent).toBe(true);
    expect(result.einvoice.lastEventId).toBe(1);
  });
});
