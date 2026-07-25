import log from "electron-log";

/**
 * Adaptateur Supabase pour la sauvegarde en ligne.
 *
 * Isole toute la connaissance du fournisseur : Auth (GoTrue) + Storage.
 * Le jour d'un passage à Scaleway/OVH, seul ce fichier est à dupliquer — la
 * couche `backup/index.js` reste inchangée.
 *
 * Authentification : email/mot de passe (Supabase Auth). L'access token est
 * court : on le garde en mémoire et on le renouvelle via le refresh token
 * (qui tourne à chaque usage → on repersiste la nouvelle valeur).
 *
 * Sécurité : les objets sont écrits sous le préfixe `${userId}/…`, ce qui
 * permet à la policy RLS du bucket de restreindre l'accès à `auth.uid()`.
 */

const MAX_RETRIES = 3;
const BACKOFF_INITIAL_MS = 500;
const ACCESS_TOKEN_MARGIN_MS = 60 * 1000;

/**
 * @param {Object} opts
 * @param {string} opts.url - URL du projet Supabase (https://xxxx.supabase.co)
 * @param {string} opts.anonKey - clé anon (publique)
 * @param {string} opts.bucket - nom du bucket Storage privé
 * @param {() => Promise<{refreshToken:string,userId:string}|null>} opts.getSession
 * @param {(s:{refreshToken:string,userId:string}) => Promise<void>} opts.saveSession
 */
export function createSupabaseAdapter({
  url,
  anonKey,
  bucket,
  getSession,
  saveSession,
}) {
  if (!url || !anonKey || !bucket) {
    throw new Error(
      "Configuration Supabase incomplète (URL, clé anon et bucket requis).",
    );
  }
  const baseUrl = url.replace(/\/$/, "");

  // État de session en mémoire
  let accessToken = null;
  let accessExpiresAt = 0;
  let userId = null;

  async function authFetch(pathname, options = {}) {
    return retryingFetch(`${baseUrl}${pathname}`, options);
  }

  // ---- Auth ----

  async function signInWithPassword(email, password) {
    const res = await retryingFetch(
      `${baseUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: { apikey: anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      },
    );
    if (!res.ok) {
      const body = await safeText(res);
      throw supabaseError(res.status, "Échec de la connexion Supabase", body);
    }
    const json = await res.json();
    applySession(json);
    await saveSession({ refreshToken: json.refresh_token, userId });
    log.info("Supabase sign-in successful");
    return { userId, email: json.user && json.user.email };
  }

  async function ensureAccessToken() {
    if (accessToken && Date.now() < accessExpiresAt - ACCESS_TOKEN_MARGIN_MS) {
      return accessToken;
    }
    const session = await getSession();
    if (!session || !session.refreshToken) {
      throw supabaseError(
        401,
        "Non connecté à Supabase. Connectez-vous dans les Paramètres.",
        null,
      );
    }
    userId = session.userId || userId;

    const res = await retryingFetch(
      `${baseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: { apikey: anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      },
    );
    if (!res.ok) {
      const body = await safeText(res);
      throw supabaseError(
        res.status,
        "Session Supabase expirée. Reconnectez-vous.",
        body,
      );
    }
    const json = await res.json();
    applySession(json);
    // Le refresh token tourne : on repersiste la nouvelle valeur.
    await saveSession({ refreshToken: json.refresh_token, userId });
    return accessToken;
  }

  function applySession(json) {
    accessToken = json.access_token;
    accessExpiresAt = Date.now() + (json.expires_in || 3600) * 1000;
    if (json.user && json.user.id) userId = json.user.id;
  }

  async function storageHeaders(extra = {}) {
    const token = await ensureAccessToken();
    return { apikey: anonKey, Authorization: `Bearer ${token}`, ...extra };
  }

  function objectPath(name) {
    if (!userId) {
      throw new Error("userId inconnu : connexion Supabase requise.");
    }
    // Préfixe par userId → la policy RLS restreint l'accès à auth.uid().
    return `${userId}/${name}`;
  }

  // ---- Storage ----

  /** Vérifie l'accès en listant le bucket (utilisé pour tester la config). */
  async function testAccess() {
    await ensureAccessToken();
    await listBackups();
    return { ok: true, userId };
  }

  async function uploadBackup(name, buffer) {
    // Headers d'abord : ensureAccessToken() résout userId, requis par objectPath.
    const headers = await storageHeaders({
      "Content-Type": "application/octet-stream",
      "x-upsert": "true",
    });
    const res = await authFetch(
      `/storage/v1/object/${bucket}/${encodeURI(objectPath(name))}`,
      { method: "POST", headers, body: buffer },
    );
    if (!res.ok) {
      const body = await safeText(res);
      throw supabaseError(res.status, "Échec de l'envoi de la sauvegarde", body);
    }
    return { name, size: buffer.length };
  }

  async function listBackups() {
    const res = await authFetch(`/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: await storageHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        prefix: userId ? `${userId}/` : "",
        limit: 1000,
        sortBy: { column: "name", order: "desc" },
      }),
    });
    if (!res.ok) {
      const body = await safeText(res);
      throw supabaseError(
        res.status,
        "Impossible de lister les sauvegardes",
        body,
      );
    }
    const items = await res.json();
    return (Array.isArray(items) ? items : [])
      .filter((it) => it && it.name && !it.name.endsWith("/"))
      .map((it) => ({
        name: it.name,
        updatedAt: it.updated_at || it.created_at || null,
        size: (it.metadata && it.metadata.size) || null,
      }));
  }

  async function removeBackups(names) {
    if (!names || names.length === 0) return { removed: 0 };
    const res = await authFetch(`/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: await storageHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: names.map((n) => objectPath(n)) }),
    });
    if (!res.ok) {
      const body = await safeText(res);
      throw supabaseError(
        res.status,
        "Impossible de supprimer d'anciennes sauvegardes",
        body,
      );
    }
    return { removed: names.length };
  }

  async function downloadBackup(name) {
    // Headers d'abord : ensureAccessToken() résout userId, requis par objectPath.
    const headers = await storageHeaders();
    const res = await authFetch(
      `/storage/v1/object/${bucket}/${encodeURI(objectPath(name))}`,
      { method: "GET", headers },
    );
    if (!res.ok) {
      const body = await safeText(res);
      throw supabaseError(
        res.status,
        "Impossible de télécharger la sauvegarde",
        body,
      );
    }
    return Buffer.from(await res.arrayBuffer());
  }

  return {
    providerName: "supabase",
    signInWithPassword,
    testAccess,
    uploadBackup,
    listBackups,
    removeBackups,
    downloadBackup,
    getUserId: () => userId,
  };
}

// ============================================================
// Helpers
// ============================================================

async function retryingFetch(url, options) {
  let attempt = 0;
  let lastError;
  while (attempt <= MAX_RETRIES) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      lastError = err;
      await sleep(BACKOFF_INITIAL_MS * 2 ** attempt);
      attempt += 1;
      continue;
    }
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      const delay = BACKOFF_INITIAL_MS * 2 ** attempt;
      log.warn(`Supabase ${res.status} on ${url}, retry in ${delay}ms`);
      await sleep(delay);
      attempt += 1;
      lastError = supabaseError(res.status, "Erreur transitoire", null);
      continue;
    }
    return res;
  }
  throw lastError || new Error("Requête Supabase échouée après plusieurs essais");
}

function supabaseError(status, message, body) {
  const err = new Error(`[Supabase HTTP ${status}] ${message}`);
  err.status = status;
  err.code = `SUPABASE_HTTP_${status}`;
  err.body = body;
  return err;
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
