import { describe, it, expect } from "vitest";
import { shouldRunStartupBackup, STALE_MS } from "../policy.js";

const NOW = new Date("2026-07-25T12:00:00.000Z").getTime();

describe("backup/policy — shouldRunStartupBackup", () => {
  it("relance si jamais sauvegardé", () => {
    expect(shouldRunStartupBackup({ lastBackupAt: null }, NOW)).toBe(true);
  });

  it("relance si la dernière tentative a échoué", () => {
    const recent = new Date(NOW - 1000).toISOString();
    expect(
      shouldRunStartupBackup({ lastBackupAt: recent, lastError: "boom" }, NOW),
    ).toBe(true);
  });

  it("relance si la dernière sauvegarde est trop ancienne (> 24 h)", () => {
    const old = new Date(NOW - STALE_MS - 1000).toISOString();
    expect(shouldRunStartupBackup({ lastBackupAt: old }, NOW)).toBe(true);
  });

  it("ne relance pas si la sauvegarde est récente et sans erreur", () => {
    const recent = new Date(NOW - 60 * 1000).toISOString();
    expect(shouldRunStartupBackup({ lastBackupAt: recent }, NOW)).toBe(false);
  });

  it("relance sur un horodatage illisible", () => {
    expect(shouldRunStartupBackup({ lastBackupAt: "pas-une-date" }, NOW)).toBe(
      true,
    );
  });

  it("relance si le bloc backup est absent", () => {
    expect(shouldRunStartupBackup(null, NOW)).toBe(true);
  });

  it("le seuil est exactement 24 h", () => {
    const justUnder = new Date(NOW - (STALE_MS - 1000)).toISOString();
    const justOver = new Date(NOW - (STALE_MS + 1000)).toISOString();
    expect(shouldRunStartupBackup({ lastBackupAt: justUnder }, NOW)).toBe(false);
    expect(shouldRunStartupBackup({ lastBackupAt: justOver }, NOW)).toBe(true);
  });
});
