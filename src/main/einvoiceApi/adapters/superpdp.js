import log from "electron-log";
import { createTokenCache } from "../tokenCache.js";
import { getProviderCredentials } from "../secureCredentials.js";

const PROVIDER_NAME = "superpdp";
const DEFAULT_BASE_URL = "https://api.superpdp.tech";
const API_VERSION = "v1.beta";

const MAX_RETRIES_5XX = 3;
const BACKOFF_INITIAL_MS = 500;

/**
 * Crée un adapter SuperPDP à partir d'une configuration einvoicePlatform.
 *
 * @param {Object} platformConfig - { urlApi?, isSandbox? }
 * @returns {Object} adapter conforme au contrat einvoiceApi
 */
export function createSuperPdpAdapter(platformConfig = {}) {
  const baseUrl = (platformConfig.urlApi || DEFAULT_BASE_URL).replace(/\/$/, "");

  async function fetchTokenForKey() {
    const creds = await getProviderCredentials(PROVIDER_NAME);
    if (!creds || !creds.client_id || !creds.client_secret) {
      throw new Error(
        "Identifiants SuperPDP manquants. Configurer la plateforme dans Paramètres.",
      );
    }

    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.client_id,
      client_secret: creds.client_secret,
    });

    const response = await fetch(`${baseUrl}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const body = await safeReadText(response);
      throw httpError(response.status, "OAuth2 token request failed", body);
    }

    const json = await response.json();
    return {
      accessToken: json.access_token,
      expiresInSeconds: json.expires_in || 1800,
    };
  }

  const tokenCache = createTokenCache(fetchTokenForKey);
  const tokenKey = `${PROVIDER_NAME}:${baseUrl}`;

  async function authHeaders() {
    const token = await tokenCache.get(tokenKey);
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Appel API protégé avec retry automatique 401 (token expiré) + backoff 5xx/429.
   */
  async function request(pathname, options = {}) {
    const url = `${baseUrl}/${API_VERSION}${pathname}`;
    let attempt = 0;
    let lastError;

    while (attempt <= MAX_RETRIES_5XX) {
      const headers = {
        ...(await authHeaders()),
        ...(options.headers || {}),
      };

      let response;
      try {
        response = await fetch(url, { ...options, headers });
      } catch (err) {
        lastError = err;
        await sleep(BACKOFF_INITIAL_MS * 2 ** attempt);
        attempt += 1;
        continue;
      }

      if (response.status === 401 && attempt === 0) {
        log.warn(`SuperPDP 401 on ${pathname}, invalidating token and retrying`);
        tokenCache.invalidate(tokenKey);
        attempt += 1;
        continue;
      }

      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        const delay = BACKOFF_INITIAL_MS * 2 ** attempt;
        log.warn(
          `SuperPDP ${response.status} on ${pathname}, retry ${attempt + 1}/${MAX_RETRIES_5XX} in ${delay}ms`,
        );
        await sleep(delay);
        attempt += 1;
        lastError = httpError(response.status, "Transient error", null);
        continue;
      }

      return response;
    }

    throw lastError || new Error(`SuperPDP request failed after ${MAX_RETRIES_5XX} retries`);
  }

  async function requestJson(pathname, options) {
    const response = await request(pathname, options);
    if (!response.ok) {
      const body = await safeReadText(response);
      throw httpError(response.status, `SuperPDP ${pathname} failed`, body);
    }
    return response.json();
  }

  // ============================================================
  // Contrat einvoiceApi
  // ============================================================

  return {
    providerName: PROVIDER_NAME,

    /** Vérifie connexion + récupère l'entreprise courante. */
    async testConnection() {
      const company = await requestJson("/companies/me");
      const session = await requestJson("/oauth2_sessions/me").catch(() => null);
      return { company, session };
    },

    /** Statut de session OAuth2 (vérification en arrière-plan SuperPDP). */
    async getSessionStatus() {
      return requestJson("/oauth2_sessions/me");
    },

    /**
     * Convertit un document entre formats XML/PDF via ?from=&to=.
     * Formats valides (from/to) : ubl, cii, factur-x. Le JSON n'est PAS supporté.
     * @param {string|Buffer} payload - document source (XML ou PDF)
     * @param {Object} opts - { from, to, contentType }
     * @returns {Promise<string|Buffer>} XML (string) ou PDF (Buffer) selon `to`
     */
    async convertInvoice(payload, { from, to, contentType = "application/xml" } = {}) {
      if (!from || !to) throw new Error("convertInvoice: 'from' et 'to' requis");
      const qs = new URLSearchParams({ from, to }).toString();
      const response = await request(`/invoices/convert?${qs}`, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: payload,
      });
      if (!response.ok) {
        const body = await safeReadText(response);
        throw httpError(response.status, "Convert failed", body);
      }
      if (to === "factur-x") {
        return Buffer.from(await response.arrayBuffer());
      }
      return response.text();
    },

    /** Envoie une facture (corps brut UBL/CII XML ou Factur-X PDF). */
    async sendInvoice(payload, { contentType = "application/xml", disablePreCheck = false } = {}) {
      const query = disablePreCheck ? "?disable_pre_check=true" : "";
      return requestJson(`/invoices${query}`, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: payload,
      });
    },

    /** Liste les factures (envoyées et reçues) avec pagination cursor-based. */
    async fetchInvoices({ order = "desc", startingAfterId, limit, direction } = {}) {
      const qs = new URLSearchParams();
      if (order) qs.set("order", order);
      if (direction) qs.set("direction", direction);
      if (startingAfterId != null) qs.set("starting_after_id", String(startingAfterId));
      if (limit != null) qs.set("limit", String(limit));
      const query = qs.toString();
      return requestJson(`/invoices${query ? `?${query}` : ""}`);
    },

    /** Détail JSON d'une facture (sans format → objet, dont en_invoice + events). */
    async getInvoice(id) {
      return requestJson(`/invoices/${encodeURIComponent(id)}`);
    },

    /**
     * Télécharge une facture en binaire.
     * @param {string|number} id
     * @param {Object} opts - { format } : 'factur-x' (PDF lisible), sinon fichier original (/download)
     * @returns {Promise<{ buffer: Buffer, contentType: string, filename: string|null }>}
     */
    async downloadInvoice(id, { format } = {}) {
      const path = format
        ? `/invoices/${encodeURIComponent(id)}?format=${encodeURIComponent(format)}`
        : `/invoices/${encodeURIComponent(id)}/download`;
      const response = await request(path);
      if (!response.ok) {
        const body = await safeReadText(response);
        throw httpError(response.status, "Download failed", body);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      return {
        buffer,
        contentType: response.headers.get("content-type") || "application/octet-stream",
        filename: parseContentDispositionFilename(response.headers.get("content-disposition")),
      };
    },

    /** Validation pré-envoi (dry-run schematron). file = Blob | Buffer | string. */
    async validateInvoice(file, fileName = "invoice.xml") {
      const form = new FormData();
      const blob = file instanceof Blob ? file : new Blob([file]);
      form.append("file", blob, fileName);

      // /validation_reports n'exige pas l'authentification mais on l'ajoute par cohérence
      const response = await fetch(`${baseUrl}/${API_VERSION}/validation_reports`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const body = await safeReadText(response);
        throw httpError(response.status, "Validation failed", body);
      }
      return response.json();
    },

    async listEvents({ startingAfterId, limit } = {}) {
      const qs = new URLSearchParams();
      if (startingAfterId != null) qs.set("starting_after_id", String(startingAfterId));
      if (limit != null) qs.set("limit", String(limit));
      const query = qs.toString();
      return requestJson(`/invoice_events${query ? `?${query}` : ""}`);
    },

    async createEvent({ invoiceId, statusCode, details }) {
      return requestJson("/invoice_events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: invoiceId,
          status_code: statusCode,
          details,
        }),
      });
    },

    async searchFrenchDirectory(siren) {
      const qs = new URLSearchParams({ number: String(siren) });
      return requestJson(`/french_directory/companies?${qs.toString()}`);
    },

    /**
     * Adresse électronique de routage de l'entreprise authentifiée (vendeur).
     * Lue depuis ses propres entrées d'annuaire. Renvoie { value, scheme } ou null.
     */
    async getOwnEndpoint() {
      const res = await requestJson("/directory_entries");
      const entries = res.data || [];
      const primary =
        entries.find((e) => !e.is_replyto && e.identifier) ||
        entries.find((e) => e.identifier);
      return primary ? parseIdentifier(primary.identifier) : null;
    },

    /**
     * Résout l'adresse électronique d'un destinataire via l'annuaire DGFiP.
     * @param {string} siren
     * @returns {Promise<{ endpoint: {value,scheme}|null, isActive: boolean, found: boolean, name?: string }>}
     */
    async resolveRecipient(siren) {
      const qs = new URLSearchParams({ number: String(siren) });
      const res = await requestJson(`/french_directory/entries?${qs.toString()}`);
      const entries = res.data || [];
      if (entries.length === 0) {
        return { found: false, isActive: false, endpoint: null };
      }
      const active = entries.find((e) => e.is_active) || entries[0];
      return {
        found: true,
        isActive: Boolean(active.is_active),
        endpoint: parseIdentifier(active.identifier),
        name: active.company && active.company.formal_name,
      };
    },

    /** Vide le cache token (utile après rotation des credentials). */
    invalidateTokenCache() {
      tokenCache.clear();
    },
  };
}

// ============================================================
// Helpers
// ============================================================

function httpError(status, message, body) {
  const err = new Error(`[SuperPDP HTTP ${status}] ${message}`);
  err.status = status;
  err.code = `SUPERPDP_HTTP_${status}`;
  err.body = body;
  return err;
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Extrait le nom de fichier d'un en-tête Content-Disposition.
 */
function parseContentDispositionFilename(header) {
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(header);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Parse un identifiant d'annuaire "scheme:value" (ex: "0225:315143296_8899").
 */
function parseIdentifier(identifier) {
  if (!identifier) return null;
  const idx = String(identifier).indexOf(":");
  if (idx === -1) return { scheme: "0225", value: identifier };
  return {
    scheme: identifier.slice(0, idx),
    value: identifier.slice(idx + 1),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
