import { describe, it, expect } from "vitest";
import { makeBackupName, selectStaleBackups } from "../naming.js";

// Ces helpers sont purs (module naming.js) : aucun import Electron ni I/O.

describe("backup/naming helpers", () => {
  it("makeBackupName produit un nom horodaté, triable et en .fbak", () => {
    const name = makeBackupName(new Date("2026-07-25T18:30:05.123Z"));
    expect(name).toBe("backup-2026-07-25T18-30-05-123Z.fbak");
  });

  it("les noms générés se trient chronologiquement par ordre lexicographique", () => {
    const a = makeBackupName(new Date("2026-07-25T10:00:00.000Z"));
    const b = makeBackupName(new Date("2026-07-25T11:00:00.000Z"));
    expect([b, a].sort()).toEqual([a, b]);
  });

  it("selectStaleBackups garde les N plus récentes et renvoie le reste", () => {
    const objects = Array.from({ length: 20 }, (_, i) => ({
      name: `backup-2026-07-${String(i + 1).padStart(2, "0")}T00-00-00-000Z.fbak`,
    }));
    const stale = selectStaleBackups(objects, 15);
    expect(stale).toHaveLength(5);
    // Ce sont bien les 5 plus anciennes (jours 01 à 05, tous < jour 06)
    expect(stale.every((n) => n < "backup-2026-07-06")).toBe(true);
  });

  it("selectStaleBackups ne supprime rien si le nombre est sous le seuil", () => {
    const objects = [
      { name: "backup-2026-07-01T00-00-00-000Z.fbak" },
      { name: "backup-2026-07-02T00-00-00-000Z.fbak" },
    ];
    expect(selectStaleBackups(objects, 15)).toEqual([]);
  });

  it("selectStaleBackups ignore les objets non-.fbak", () => {
    const objects = [
      { name: "autre-fichier.txt" },
      { name: "backup-2026-07-01T00-00-00-000Z.fbak" },
    ];
    expect(selectStaleBackups(objects, 15)).toEqual([]);
  });

  it("selectStaleBackups tolère une entrée vide/nulle", () => {
    expect(selectStaleBackups(null, 15)).toEqual([]);
    expect(selectStaleBackups([null, undefined], 15)).toEqual([]);
  });
});
