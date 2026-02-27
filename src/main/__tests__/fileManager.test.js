import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

// ── Mocks ────────────────────────────────────────────────────

// Mock electron-log (no-op)
vi.mock("electron-log", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Temp directory paths — set per-test in beforeEach
let tmpDir;
let mockPaths;

vi.mock("../utils/paths", () => {
  // Return a factory that reads the live `mockPaths` variable
  return {
    default: {
      get DATA_DIR() {
        return mockPaths.DATA_DIR;
      },
      get CONFIG_PATH() {
        return mockPaths.CONFIG_PATH;
      },
      get DEVIS_DIR() {
        return mockPaths.DEVIS_DIR;
      },
      get FACTURES_DIR() {
        return mockPaths.FACTURES_DIR;
      },
      get CLIENTS_PATH() {
        return mockPaths.CLIENTS_PATH;
      },
      get LOGO_PATH() {
        return path.join(mockPaths.DATA_DIR, "logo.png");
      },
    },
    getYearFolder(type, year) {
      const baseDir =
        type === "devis" ? mockPaths.DEVIS_DIR : mockPaths.FACTURES_DIR;
      return path.join(baseDir, String(year));
    },
  };
});

// Import after mocks are registered
const {
  loadConfig,
  saveConfig,
  saveDocument,
  loadDocuments,
  loadDocument,
  deleteDocument,
  loadClients,
  saveClient,
  deleteClient,
} = await import("../fileManager.js");

// ── Helpers ──────────────────────────────────────────────────

const sampleConfig = {
  company: { companyName: "Test Corp" },
  billing: { latestQuoteNumber: 0, latestInvoiceNumber: 0 },
};

function makeQuote(overrides = {}) {
  return {
    type: "devis",
    numero: "D000001",
    date: "15/01/2027",
    validityDate: "15/02/2027",
    status: "draft",
    customer: {
      customerName: "Client A",
      companyName: "Société A",
      address: "1 rue Test",
      postalCode: "44000",
      city: "Nantes",
      email: "a@test.fr",
      clientType: "professionnel",
      companyId: "123 456 789 00012",
    },
    services: [
      {
        id: 1,
        description: "Dev",
        quantity: 10,
        unit: "heure",
        unitPriceHT: 60,
        totalHT: 600,
      },
    ],
    totals: { totalHT: 600, VAT: 0, VATRate: 0, totalTTC: 600 },
    ...overrides,
  };
}

// ── Setup / Teardown ─────────────────────────────────────────

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "factu-test-"));
  mockPaths = {
    DATA_DIR: tmpDir,
    CONFIG_PATH: path.join(tmpDir, "config.json"),
    DEVIS_DIR: path.join(tmpDir, "devis"),
    FACTURES_DIR: path.join(tmpDir, "factures"),
    CLIENTS_PATH: path.join(tmpDir, "clients.json"),
  };
  // Create directories
  await fs.mkdir(mockPaths.DEVIS_DIR, { recursive: true });
  await fs.mkdir(mockPaths.FACTURES_DIR, { recursive: true });
});

afterEach(async () => {
  // Reset the config cache (module-level let)
  // We do this by calling a round-trip save+clear cycle
  // Actually the cache is internal; we just re-import won't help.
  // Instead we rely on the fact that each test creates fresh files.
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ──────────────────────────────────────────────────────────────
//  Config
// ──────────────────────────────────────────────────────────────

describe("Config", () => {
  it("loadConfig reads config.json", async () => {
    await fs.writeFile(
      mockPaths.CONFIG_PATH,
      JSON.stringify(sampleConfig),
      "utf-8",
    );
    const config = await loadConfig();
    expect(config.company.companyName).toBe("Test Corp");
  });

  it("saveConfig writes and updates the cache", async () => {
    // Write an initial config so loadConfig works
    await fs.writeFile(
      mockPaths.CONFIG_PATH,
      JSON.stringify(sampleConfig),
      "utf-8",
    );
    const updated = { ...sampleConfig, company: { companyName: "Updated" } };
    await saveConfig(updated);

    // Read from disk to verify
    const raw = JSON.parse(
      await fs.readFile(mockPaths.CONFIG_PATH, "utf-8"),
    );
    expect(raw.company.companyName).toBe("Updated");
  });
});

// ──────────────────────────────────────────────────────────────
//  Documents (devis + factures)
// ──────────────────────────────────────────────────────────────

describe("Documents", () => {
  it("saveDocument creates the JSON file with correct content", async () => {
    const doc = makeQuote();
    const saved = await saveDocument("devis", doc);

    const year = new Date().getFullYear();
    const filePath = path.join(
      mockPaths.DEVIS_DIR,
      String(year),
      `${saved.id}.json`,
    );
    const raw = JSON.parse(await fs.readFile(filePath, "utf-8"));
    expect(raw.numero).toBe("D000001");
    expect(raw.customer.customerName).toBe("Client A");
  });

  it("saveDocument generates createdAt and editedAt for a new doc", async () => {
    const doc = makeQuote();
    const saved = await saveDocument("devis", doc);
    expect(saved.createdAt).toBeDefined();
    expect(saved.editedAt).toBeDefined();
  });

  it("saveDocument updates editedAt without overwriting createdAt on existing doc", async () => {
    const doc = makeQuote({ createdAt: "2027-01-01T00:00:00Z" });
    const saved = await saveDocument("devis", doc);
    expect(saved.createdAt).toBe("2027-01-01T00:00:00Z");
    expect(saved.editedAt).not.toBe("2027-01-01T00:00:00Z");
  });

  it("saveDocument assigns id from numero if no id", async () => {
    const doc = makeQuote();
    delete doc.id;
    const saved = await saveDocument("devis", doc);
    expect(saved.id).toBe("D000001");
  });

  it("loadDocuments returns all documents for a type/year", async () => {
    await saveDocument("devis", makeQuote({ numero: "D000001" }));
    await saveDocument("devis", makeQuote({ numero: "D000002" }));
    const docs = await loadDocuments("devis", {
      year: new Date().getFullYear(),
    });
    expect(docs).toHaveLength(2);
  });

  it("loadDocuments filters by status", async () => {
    await saveDocument("devis", makeQuote({ numero: "D000001", status: "draft" }));
    await saveDocument("devis", makeQuote({ numero: "D000002", status: "sent" }));
    const docs = await loadDocuments("devis", {
      year: new Date().getFullYear(),
      status: "draft",
    });
    expect(docs).toHaveLength(1);
    expect(docs[0].numero).toBe("D000001");
  });

  it("loadDocuments filters by search (numero, customerName, companyName)", async () => {
    await saveDocument(
      "devis",
      makeQuote({
        numero: "D000001",
        customer: {
          ...makeQuote().customer,
          customerName: "Alice Dupont",
          companyName: "AliceCorp",
        },
      }),
    );
    await saveDocument(
      "devis",
      makeQuote({
        numero: "D000002",
        customer: {
          ...makeQuote().customer,
          customerName: "Bob Martin",
          companyName: "BobCorp",
        },
      }),
    );

    const byNumero = await loadDocuments("devis", {
      year: new Date().getFullYear(),
      search: "D000001",
    });
    expect(byNumero).toHaveLength(1);

    const byName = await loadDocuments("devis", {
      year: new Date().getFullYear(),
      search: "alice",
    });
    expect(byName).toHaveLength(1);

    const byCompany = await loadDocuments("devis", {
      year: new Date().getFullYear(),
      search: "bobcorp",
    });
    expect(byCompany).toHaveLength(1);
  });

  it("loadDocuments sorts by date descending", async () => {
    await saveDocument(
      "devis",
      makeQuote({ numero: "D000001", createdAt: "2027-01-01T00:00:00Z" }),
    );
    await saveDocument(
      "devis",
      makeQuote({ numero: "D000002", createdAt: "2027-06-01T00:00:00Z" }),
    );
    const docs = await loadDocuments("devis", {
      year: new Date().getFullYear(),
    });
    // Most recent first
    expect(docs[0].numero).toBe("D000002");
    expect(docs[1].numero).toBe("D000001");
  });

  it("loadDocuments returns empty array if folder is empty", async () => {
    const docs = await loadDocuments("devis", {
      year: new Date().getFullYear(),
    });
    expect(docs).toEqual([]);
  });

  it("loadDocument returns a specific document by id", async () => {
    await saveDocument("devis", makeQuote({ numero: "D000001" }));
    const doc = await loadDocument("devis", "D000001");
    expect(doc.numero).toBe("D000001");
  });

  it("loadDocument throws if document not found", async () => {
    await expect(loadDocument("devis", "D999999")).rejects.toThrow(
      "Document introuvable",
    );
  });

  it("deleteDocument removes the file", async () => {
    await saveDocument("devis", makeQuote({ numero: "D000001" }));
    await deleteDocument("devis", "D000001");

    await expect(loadDocument("devis", "D000001")).rejects.toThrow(
      "Document introuvable",
    );
  });

  it("deleteDocument throws if document not found", async () => {
    await expect(deleteDocument("devis", "D999999")).rejects.toThrow(
      "Document introuvable",
    );
  });

  it("full cycle: save → load → verify → delete → verify deleted", async () => {
    const doc = makeQuote({ numero: "D000010" });
    await saveDocument("devis", doc);

    // Load
    const loaded = await loadDocument("devis", "D000010");
    expect(loaded.numero).toBe("D000010");
    expect(loaded.customer.customerName).toBe("Client A");
    expect(loaded.services).toHaveLength(1);
    expect(loaded.totals.totalHT).toBe(600);

    // Delete
    await deleteDocument("devis", "D000010");
    await expect(loadDocument("devis", "D000010")).rejects.toThrow(
      "Document introuvable",
    );
  });

  it("works the same for factures type", async () => {
    const invoice = makeQuote({
      type: "facture",
      numero: "F000001",
      dueDate: "15/02/2027",
    });
    const saved = await saveDocument("factures", invoice);
    expect(saved.id).toBe("F000001");

    const loaded = await loadDocument("factures", "F000001");
    expect(loaded.type).toBe("facture");

    await deleteDocument("factures", "F000001");
    await expect(loadDocument("factures", "F000001")).rejects.toThrow();
  });
});

// ──────────────────────────────────────────────────────────────
//  Clients
// ──────────────────────────────────────────────────────────────

describe("Clients", () => {
  it("saveClient adds a new client (generates id + createdAt)", async () => {
    const client = { customerName: "Client A", city: "Nantes" };
    const saved = await saveClient(client);
    expect(saved.id).toBeDefined();
    expect(saved.createdAt).toBeDefined();
  });

  it("saveClient updates an existing client by id", async () => {
    const client = { customerName: "Client A", city: "Nantes" };
    const saved = await saveClient(client);

    saved.customerName = "Client A Updated";
    const updated = await saveClient(saved);
    expect(updated.customerName).toBe("Client A Updated");
    expect(updated.id).toBe(saved.id);

    // Only one client in the file
    const all = await loadClients();
    expect(all).toHaveLength(1);
    expect(all[0].customerName).toBe("Client A Updated");
  });

  it("loadClients returns all clients", async () => {
    await saveClient({ customerName: "A" });
    await saveClient({ customerName: "B" });
    const all = await loadClients();
    expect(all).toHaveLength(2);
  });

  it("loadClients returns [] if file does not exist", async () => {
    // Don't create the clients file — it doesn't exist yet
    const clients = await loadClients();
    expect(clients).toEqual([]);
  });

  it("deleteClient removes a client", async () => {
    const saved = await saveClient({ customerName: "To Delete" });
    await deleteClient(saved.id);
    const all = await loadClients();
    expect(all).toHaveLength(0);
  });

  it("deleteClient throws if client not found", async () => {
    // Create the file so it doesn't fail on read
    await saveClient({ customerName: "Existing" });
    await expect(deleteClient("nonexistent-id")).rejects.toThrow();
  });

  it("full cycle: save → load → update → load → verify → delete → verify", async () => {
    // Save
    const saved = await saveClient({
      customerName: "Cycle Client",
      city: "Paris",
    });
    expect(saved.id).toBeDefined();

    // Load
    let clients = await loadClients();
    expect(clients).toHaveLength(1);
    expect(clients[0].customerName).toBe("Cycle Client");

    // Update
    saved.city = "Lyon";
    await saveClient(saved);
    clients = await loadClients();
    expect(clients).toHaveLength(1);
    expect(clients[0].city).toBe("Lyon");

    // Delete
    await deleteClient(saved.id);
    clients = await loadClients();
    expect(clients).toHaveLength(0);
  });
});
