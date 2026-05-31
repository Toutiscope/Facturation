import log from "electron-log";

const REFRESH_MARGIN_MS = 60 * 1000;

/**
 * Cache mémoire des access_tokens OAuth2 par clé (typiquement providerName + client_id).
 * Gère le renouvellement automatique avant expiration et la déduplication des requêtes concurrentes.
 */
export function createTokenCache(fetchToken) {
  if (typeof fetchToken !== "function") {
    throw new Error("createTokenCache requires a fetchToken function");
  }

  const cache = new Map();
  const pending = new Map();

  function isExpired(entry, now = Date.now()) {
    if (!entry) return true;
    return entry.expiresAt - REFRESH_MARGIN_MS <= now;
  }

  async function get(key) {
    const cached = cache.get(key);
    if (cached && !isExpired(cached)) {
      return cached.accessToken;
    }
    return refresh(key);
  }

  async function refresh(key) {
    if (pending.has(key)) {
      return pending.get(key);
    }

    const promise = (async () => {
      try {
        const { accessToken, expiresInSeconds } = await fetchToken(key);
        const expiresAt = Date.now() + expiresInSeconds * 1000;
        cache.set(key, { accessToken, expiresAt });
        log.debug(`OAuth2 token refreshed for key=${key} (expires in ${expiresInSeconds}s)`);
        return accessToken;
      } finally {
        pending.delete(key);
      }
    })();

    pending.set(key, promise);
    return promise;
  }

  function invalidate(key) {
    cache.delete(key);
  }

  function clear() {
    cache.clear();
    pending.clear();
  }

  return { get, refresh, invalidate, clear };
}
