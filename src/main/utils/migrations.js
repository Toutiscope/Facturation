import { DEFAULT_CONFIG } from "./paths.js";
import { defaultEinvoice } from "../validator.js";

/**
 * Migrations lazy : hydratent les données chargées avec les nouveaux champs
 * sans toucher au fichier sur disque. La persistance se fait à la prochaine
 * sauvegarde par l'utilisateur (saveConfig / saveDocument).
 */

/**
 * Vrai si la valeur est un objet "plain" (ni null, ni tableau).
 */
function isPlainObject(value) {
  return (
    value !== null && typeof value === "object" && !Array.isArray(value)
  );
}

/**
 * Fusion profonde non destructive : complète `target` avec les champs présents
 * dans `defaults`. Les valeurs déjà définies dans `target` sont toujours
 * conservées (y compris `null`, `false`, `0`, `""`) ; seuls les champs
 * `undefined` (ou absents) sont remplis depuis `defaults`. Un bloc attendu
 * comme objet mais corrompu (string, tableau, null) est remplacé par le défaut.
 *
 * @param {Object} target - données existantes
 * @param {Object} defaults - schéma de référence
 * @returns {Object} nouvel objet (n'altère pas `target`)
 */
function deepMergeDefaults(target, defaults) {
  const source = isPlainObject(target) ? target : {};
  const result = { ...source };

  for (const key of Object.keys(defaults)) {
    const defaultValue = defaults[key];

    if (isPlainObject(defaultValue)) {
      result[key] = deepMergeDefaults(source[key], defaultValue);
    } else if (result[key] === undefined) {
      result[key] = defaultValue;
    }
  }

  return result;
}

/**
 * Hydrate une configuration utilisateur en ajoutant les blocs et champs
 * manquants (rétro-compatibilité quand le schéma de config évolue). Les
 * valeurs saisies par l'utilisateur sont toujours préservées.
 *
 * @param {Object} config
 * @returns {Object} nouvelle config (immuable côté entrée)
 */
export function hydrateConfig(config) {
  if (!isPlainObject(config)) {
    return config;
  }

  return deepMergeDefaults(config, DEFAULT_CONFIG);
}

/**
 * Hydrate un document s'il s'agit d'une facture sans bloc `einvoice`.
 * Les devis sont retournés inchangés.
 *
 * @param {string} type - 'devis' ou 'factures'
 * @param {Object} document
 * @returns {Object}
 */
export function hydrateDocument(type, document) {
  if (!document || type !== "factures") return document;
  if (document.einvoice && typeof document.einvoice === "object") return document;

  return { ...document, einvoice: defaultEinvoice() };
}
