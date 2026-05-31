import log from "electron-log";

/**
 * Recherche d'entreprises françaises par nom (ou SIREN/SIRET) via l'API publique
 * et gratuite « Recherche d'Entreprises » (DINUM / data.gouv.fr).
 *
 * - Aucune authentification requise, ~7 req/s côté API.
 * - L'appel réseau est fait depuis le process main (pas de souci CORS, et on
 *   reste cohérent avec l'architecture IPC du projet).
 * - Renvoie des suggestions déjà mappées sur la structure `customer` locale,
 *   prêtes à être injectées dans le formulaire client.
 *
 * Doc : https://www.data.gouv.fr/dataservices/api-recherche-dentreprises
 */
const SEARCH_BASE_URL = "https://recherche-entreprises.api.gouv.fr/search";

/**
 * @param {string} query Nom, raison sociale, SIREN ou SIRET
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array<object>>} suggestions mappées (vide si requête trop courte)
 */
export async function searchCompanies(query, { limit = 8 } = {}) {
  const q = typeof query === "string" ? query.trim() : "";
  if (q.length < 3) return [];

  const url =
    `${SEARCH_BASE_URL}?q=${encodeURIComponent(q)}` +
    `&page=1&per_page=${limit}`;

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const err = new Error(`Recherche entreprises: HTTP ${response.status}`);
    err.status = response.status;
    err.body = body;
    throw err;
  }

  const payload = await response.json();
  const results = Array.isArray(payload.results) ? payload.results : [];
  return results.map(mapCompany).filter(Boolean);
}

/**
 * Mappe une entrée de l'API vers la structure `customer` locale.
 * @param {object} entry
 */
function mapCompany(entry) {
  if (!entry) return null;
  const siege = entry.siege || {};
  const name = entry.nom_complet || entry.nom_raison_sociale || "";
  return {
    siren: entry.siren || "",
    companyId: formatSiret(siege.siret || ""),
    companyName: entry.nom_raison_sociale || name,
    customerName: name,
    address: buildStreet(siege),
    postalCode: siege.code_postal || "",
    city: siege.libelle_commune || "",
    // Permet au front d'avertir si l'établissement est administrativement fermé.
    closed: entry.etat_administratif === "C",
  };
}

/**
 * Reconstitue l'adresse de voie (sans code postal ni commune).
 * @param {object} siege
 */
function buildStreet(siege) {
  const street = [siege.numero_voie, siege.type_voie, siege.libelle_voie]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (street) return street;

  // Repli : `adresse` complète, on retire le code postal + la commune en fin.
  const full = (siege.adresse || "").trim();
  const tail = `${siege.code_postal || ""} ${siege.libelle_commune || ""}`.trim();
  if (tail && full.endsWith(tail)) return full.slice(0, -tail.length).trim();
  return full;
}

/**
 * Formate un SIRET (14 chiffres) en groupes lisibles : `123 456 789 00012`.
 * @param {string} siret
 */
function formatSiret(siret) {
  const digits = (siret || "").replace(/\D/g, "");
  if (digits.length !== 14) return siret || "";
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
}
