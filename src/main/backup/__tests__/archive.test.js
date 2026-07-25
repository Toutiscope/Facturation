import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { buildArchive, extractArchive, writeArchiveFiles } from "../archive.js";

let dataDir;

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "factu-backup-"));
});

afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

async function seedData() {
  await fs.writeFile(
    path.join(dataDir, "config.json"),
    JSON.stringify({ company: { companyName: "Acme" } }),
    "utf8",
  );
  await fs.writeFile(path.join(dataDir, "clients.json"), "[]", "utf8");
  await fs.writeFile(path.join(dataDir, "transactions.json"), "[]", "utf8");
  // Logo binaire (contenu factice non-UTF8)
  await fs.writeFile(path.join(dataDir, "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]));
  // Documents dans des sous-dossiers par année
  const devis2027 = path.join(dataDir, "devis", "2027");
  const factures2027 = path.join(dataDir, "factures", "2027");
  await fs.mkdir(devis2027, { recursive: true });
  await fs.mkdir(factures2027, { recursive: true });
  await fs.writeFile(path.join(devis2027, "D000001.json"), JSON.stringify({ numero: "D000001" }), "utf8");
  await fs.writeFile(path.join(factures2027, "F000001.json"), JSON.stringify({ numero: "F000001" }), "utf8");
}

describe("backup/archive", () => {
  it("inclut config, clients, transactions, logo et les documents par année", async () => {
    await seedData();
    const manifest = extractArchive(await buildArchive(dataDir));

    const paths = manifest.files.map((f) => f.path).sort();
    expect(paths).toContain("config.json");
    expect(paths).toContain("clients.json");
    expect(paths).toContain("transactions.json");
    expect(paths).toContain("logo.png");
    expect(paths).toContain("devis/2027/D000001.json");
    expect(paths).toContain("factures/2027/F000001.json");
  });

  it("utilise base64 pour le logo et utf8 pour le JSON", async () => {
    await seedData();
    const manifest = extractArchive(await buildArchive(dataDir));
    const logo = manifest.files.find((f) => f.path === "logo.png");
    const config = manifest.files.find((f) => f.path === "config.json");
    expect(logo.encoding).toBe("base64");
    expect(config.encoding).toBe("utf8");
  });

  it("exclut les secrets (credentials.enc / backup-secrets.enc)", async () => {
    await seedData();
    await fs.writeFile(path.join(dataDir, "credentials.enc"), "secret");
    await fs.writeFile(path.join(dataDir, "backup-secrets.enc"), "secret");
    const manifest = extractArchive(await buildArchive(dataDir));
    const paths = manifest.files.map((f) => f.path);
    expect(paths).not.toContain("credentials.enc");
    expect(paths).not.toContain("backup-secrets.enc");
  });

  it("ignore silencieusement les fichiers optionnels absents", async () => {
    // Seulement config.json, pas de logo ni clients
    await fs.writeFile(path.join(dataDir, "config.json"), "{}", "utf8");
    const manifest = extractArchive(await buildArchive(dataDir));
    expect(manifest.files.map((f) => f.path)).toEqual(["config.json"]);
  });

  it("round-trip complet : build → extract → writeArchiveFiles restaure à l'identique", async () => {
    await seedData();
    const manifest = extractArchive(await buildArchive(dataDir));

    const restoreDir = await fs.mkdtemp(path.join(os.tmpdir(), "factu-restore-"));
    try {
      await writeArchiveFiles(manifest.files, restoreDir);

      // Le logo binaire est identique octet à octet
      const originalLogo = await fs.readFile(path.join(dataDir, "logo.png"));
      const restoredLogo = await fs.readFile(path.join(restoreDir, "logo.png"));
      expect(restoredLogo.equals(originalLogo)).toBe(true);

      // Un document imbriqué est restauré au bon chemin
      const doc = JSON.parse(
        await fs.readFile(path.join(restoreDir, "devis", "2027", "D000001.json"), "utf8"),
      );
      expect(doc.numero).toBe("D000001");
    } finally {
      await fs.rm(restoreDir, { recursive: true, force: true });
    }
  });

  it("writeArchiveFiles refuse un chemin qui sort du dossier cible", async () => {
    const restoreDir = await fs.mkdtemp(path.join(os.tmpdir(), "factu-restore-"));
    try {
      await expect(
        writeArchiveFiles(
          [{ path: "../evil.json", encoding: "utf8", content: "x" }],
          restoreDir,
        ),
      ).rejects.toThrow(/invalide/i);
    } finally {
      await fs.rm(restoreDir, { recursive: true, force: true });
    }
  });

  it("le manifeste porte version, createdAt et fileCount cohérents", async () => {
    await seedData();
    const manifest = extractArchive(await buildArchive(dataDir));
    expect(manifest.version).toBe(1);
    expect(typeof manifest.createdAt).toBe("string");
    expect(manifest.fileCount).toBe(manifest.files.length);
  });
});
