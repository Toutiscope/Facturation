import { describe, it, expect } from "vitest";
import { useNumbering } from "../../renderer/composables/useNumbering.js";

// ──────────────────────────────────────────────────────────────
//  isValidFormat
// ──────────────────────────────────────────────────────────────

describe("isValidFormat", () => {
  it("accepte D000001 pour devis", () => {
    const { isValidFormat } = useNumbering("devis");
    expect(isValidFormat("D000001")).toBe(true);
  });

  it("accepte D999999 pour devis", () => {
    const { isValidFormat } = useNumbering("devis");
    expect(isValidFormat("D999999")).toBe(true);
  });

  it("rejette F000001 pour devis (mauvais préfixe)", () => {
    const { isValidFormat } = useNumbering("devis");
    expect(isValidFormat("F000001")).toBe(false);
  });

  it("rejette D00001 pour devis (5 chiffres)", () => {
    const { isValidFormat } = useNumbering("devis");
    expect(isValidFormat("D00001")).toBe(false);
  });

  it("rejette D0000001 pour devis (7 chiffres)", () => {
    const { isValidFormat } = useNumbering("devis");
    expect(isValidFormat("D0000001")).toBe(false);
  });

  it("accepte F000001 pour factures", () => {
    const { isValidFormat } = useNumbering("factures");
    expect(isValidFormat("F000001")).toBe(true);
  });

  it("rejette D000001 pour factures (mauvais préfixe)", () => {
    const { isValidFormat } = useNumbering("factures");
    expect(isValidFormat("D000001")).toBe(false);
  });

  it("rejette chaîne vide", () => {
    const { isValidFormat } = useNumbering("devis");
    expect(isValidFormat("")).toBe(false);
  });

  it("rejette chaîne sans préfixe", () => {
    const { isValidFormat } = useNumbering("devis");
    expect(isValidFormat("000001")).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
//  isNumberUsed
// ──────────────────────────────────────────────────────────────

describe("isNumberUsed", () => {
  const docs = [
    { numero: "D000001" },
    { numero: "D000002" },
    { numero: "D000003" },
  ];

  it("détecte un doublon", () => {
    const { isNumberUsed } = useNumbering("devis");
    expect(isNumberUsed("D000002", docs)).toBe(true);
  });

  it("retourne false si pas de doublon", () => {
    const { isNumberUsed } = useNumbering("devis");
    expect(isNumberUsed("D000099", docs)).toBe(false);
  });

  it("retourne false sur liste vide", () => {
    const { isNumberUsed } = useNumbering("devis");
    expect(isNumberUsed("D000001", [])).toBe(false);
  });

  it("retourne false sans liste fournie", () => {
    const { isNumberUsed } = useNumbering("devis");
    expect(isNumberUsed("D000001")).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
//  formatNumber
// ──────────────────────────────────────────────────────────────

describe("formatNumber", () => {
  it("produit D000001 pour devis avec num 1", () => {
    const { formatNumber } = useNumbering("devis");
    expect(formatNumber(1)).toBe("D000001");
  });

  it("produit F000025 pour factures avec num 25", () => {
    const { formatNumber } = useNumbering("factures");
    expect(formatNumber(25)).toBe("F000025");
  });

  it("gère les grands numéros (pas de troncature)", () => {
    const { formatNumber } = useNumbering("devis");
    expect(formatNumber(123456)).toBe("D123456");
  });

  it("gère les numéros dépassant 6 chiffres", () => {
    const { formatNumber } = useNumbering("devis");
    expect(formatNumber(1234567)).toBe("D1234567");
  });

  it("produit D000000 pour num 0", () => {
    const { formatNumber } = useNumbering("devis");
    expect(formatNumber(0)).toBe("D000000");
  });
});
