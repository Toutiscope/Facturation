import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "crypto";

/**
 * Chiffrement des archives de sauvegarde.
 *
 * Contrainte clé du projet : une sauvegarde de récupération doit rester
 * déchiffrable sur une machine NEUVE (le PC d'origine peut être mort). La clé
 * ne peut donc pas venir de `safeStorage` (liée à la machine) : elle est
 * DÉRIVÉE d'une phrase de récupération que l'utilisateur connaît (scrypt).
 *
 * Le fichier produit est AUTO-PORTÉ : il embarque le sel et l'IV, si bien que
 * la seule chose nécessaire pour restaurer est la phrase de récupération —
 * aucune dépendance à la config locale.
 *
 * Format binaire :
 *   [ MAGIC(4) | VERSION(1) | SALT(16) | IV(12) | TAG(16) | CIPHERTEXT(...) ]
 */

const MAGIC = Buffer.from("FBAK", "ascii"); // Facturation BAcKup
const VERSION = 1;
const SALT_LEN = 16;
const IV_LEN = 12; // recommandé pour AES-GCM
const TAG_LEN = 16;
const KEY_LEN = 32; // AES-256
const HEADER_LEN = MAGIC.length + 1 + SALT_LEN + IV_LEN + TAG_LEN;

// Paramètres scrypt. N=16384 maintient l'usage mémoire (~16 Mo) sous le
// `maxmem` par défaut de Node tout en restant robuste au brute-force.
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

/**
 * Dérive une clé AES-256 (32 octets) à partir d'une phrase et d'un sel.
 * @param {string} passphrase
 * @param {Buffer} salt
 * @returns {Buffer} clé de 32 octets
 */
export function deriveKey(passphrase, salt) {
  if (typeof passphrase !== "string" || passphrase.length === 0) {
    throw new Error("Phrase de récupération manquante");
  }
  return scryptSync(passphrase.normalize("NFKC"), salt, KEY_LEN, SCRYPT_PARAMS);
}

/**
 * Chiffre un buffer avec une phrase de récupération.
 * Génère un sel et un IV aléatoires embarqués dans le résultat.
 *
 * @param {Buffer} plaintext - données en clair (archive gzip)
 * @param {string} passphrase - phrase de récupération
 * @returns {Buffer} blob chiffré auto-porté
 */
export function encrypt(plaintext, passphrase) {
  if (!Buffer.isBuffer(plaintext)) {
    throw new Error("encrypt attend un Buffer");
  }
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([
    MAGIC,
    Buffer.from([VERSION]),
    salt,
    iv,
    tag,
    ciphertext,
  ]);
}

/**
 * Déchiffre un blob produit par `encrypt`.
 * Lève une erreur claire si la phrase est incorrecte ou le fichier altéré
 * (l'authentification GCM échoue).
 *
 * @param {Buffer} blob - blob chiffré auto-porté
 * @param {string} passphrase - phrase de récupération
 * @returns {Buffer} données en clair
 */
export function decrypt(blob, passphrase) {
  if (!Buffer.isBuffer(blob) || blob.length < HEADER_LEN) {
    throw new Error("Fichier de sauvegarde invalide ou tronqué");
  }

  let offset = 0;
  const magic = blob.subarray(offset, (offset += MAGIC.length));
  if (!timingSafeEqual(magic, MAGIC)) {
    throw new Error("Fichier de sauvegarde non reconnu (en-tête invalide)");
  }

  const version = blob[offset];
  offset += 1;
  if (version !== VERSION) {
    throw new Error(`Version de sauvegarde non supportée : ${version}`);
  }

  const salt = blob.subarray(offset, (offset += SALT_LEN));
  const iv = blob.subarray(offset, (offset += IV_LEN));
  const tag = blob.subarray(offset, (offset += TAG_LEN));
  const ciphertext = blob.subarray(offset);

  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    // GCM lève à `final()` si le tag ne correspond pas : mauvaise phrase
    // ou données corrompues.
    throw new Error(
      "Déchiffrement impossible : phrase de récupération incorrecte ou " +
        "fichier de sauvegarde corrompu.",
    );
  }
}
