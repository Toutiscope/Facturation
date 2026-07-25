import { describe, it, expect } from "vitest";
import { encrypt, decrypt, deriveKey } from "../crypto.js";

const PASSPHRASE = "correcte cheval batterie agrafe";

describe("backup/crypto", () => {
  it("round-trip : decrypt(encrypt(x)) === x", () => {
    const plaintext = Buffer.from("des données de facturation sensibles", "utf8");
    const blob = encrypt(plaintext, PASSPHRASE);
    const back = decrypt(blob, PASSPHRASE);
    expect(back.equals(plaintext)).toBe(true);
  });

  it("préserve les données binaires arbitraires", () => {
    const plaintext = Buffer.from([0x00, 0xff, 0x10, 0x80, 0x7f, 0x00]);
    const back = decrypt(encrypt(plaintext, PASSPHRASE), PASSPHRASE);
    expect(back.equals(plaintext)).toBe(true);
  });

  it("produit un blob différent à chaque appel (sel + IV aléatoires)", () => {
    const plaintext = Buffer.from("identique", "utf8");
    const a = encrypt(plaintext, PASSPHRASE);
    const b = encrypt(plaintext, PASSPHRASE);
    expect(a.equals(b)).toBe(false);
    // Mais les deux se déchiffrent vers la même valeur
    expect(decrypt(a, PASSPHRASE).equals(decrypt(b, PASSPHRASE))).toBe(true);
  });

  it("échoue avec une phrase de récupération incorrecte", () => {
    const blob = encrypt(Buffer.from("secret", "utf8"), PASSPHRASE);
    expect(() => decrypt(blob, "mauvaise phrase")).toThrow(
      /incorrecte ou.*corrompu/i,
    );
  });

  it("échoue si le blob est altéré (intégrité GCM)", () => {
    const blob = encrypt(Buffer.from("secret", "utf8"), PASSPHRASE);
    // Corrompt un octet du ciphertext (après l'en-tête)
    blob[blob.length - 1] ^= 0xff;
    expect(() => decrypt(blob, PASSPHRASE)).toThrow();
  });

  it("rejette un blob trop court ou non reconnu", () => {
    expect(() => decrypt(Buffer.from("xx"), PASSPHRASE)).toThrow(
      /invalide ou tronqué/i,
    );
    const bogus = Buffer.alloc(60); // assez long mais mauvais magic
    expect(() => decrypt(bogus, PASSPHRASE)).toThrow(/non reconnu/i);
  });

  it("deriveKey est déterministe pour un même sel et produit 32 octets", () => {
    const salt = Buffer.alloc(16, 7);
    const k1 = deriveKey(PASSPHRASE, salt);
    const k2 = deriveKey(PASSPHRASE, salt);
    expect(k1.length).toBe(32);
    expect(k1.equals(k2)).toBe(true);
  });

  it("deriveKey rejette une phrase vide", () => {
    expect(() => deriveKey("", Buffer.alloc(16))).toThrow(/manquante/i);
  });
});
