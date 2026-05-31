import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("electron-log", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { createTokenCache } = await import("../tokenCache.js");

describe("createTokenCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retourne un token frais en cache sans appeler fetchToken une deuxième fois", async () => {
    const fetchToken = vi.fn().mockResolvedValue({
      accessToken: "tok-1",
      expiresInSeconds: 1800,
    });

    const cache = createTokenCache(fetchToken);

    expect(await cache.get("key")).toBe("tok-1");
    expect(await cache.get("key")).toBe("tok-1");
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it("rafraîchit automatiquement quand le token approche de l'expiration", async () => {
    const fetchToken = vi
      .fn()
      .mockResolvedValueOnce({ accessToken: "tok-1", expiresInSeconds: 120 })
      .mockResolvedValueOnce({ accessToken: "tok-2", expiresInSeconds: 1800 });

    const cache = createTokenCache(fetchToken);

    expect(await cache.get("key")).toBe("tok-1");

    vi.advanceTimersByTime(80 * 1000);
    expect(await cache.get("key")).toBe("tok-2");
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it("dédupe les requêtes concurrentes sur la même clé", async () => {
    let resolveFn;
    const fetchToken = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
    );

    const cache = createTokenCache(fetchToken);

    const [p1, p2] = [cache.get("key"), cache.get("key")];
    resolveFn({ accessToken: "tok-1", expiresInSeconds: 1800 });

    expect(await p1).toBe("tok-1");
    expect(await p2).toBe("tok-1");
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it("invalidate force un nouvel appel à fetchToken", async () => {
    const fetchToken = vi
      .fn()
      .mockResolvedValueOnce({ accessToken: "tok-1", expiresInSeconds: 1800 })
      .mockResolvedValueOnce({ accessToken: "tok-2", expiresInSeconds: 1800 });

    const cache = createTokenCache(fetchToken);

    expect(await cache.get("key")).toBe("tok-1");
    cache.invalidate("key");
    expect(await cache.get("key")).toBe("tok-2");
  });

  it("clear vide complètement le cache", async () => {
    const fetchToken = vi
      .fn()
      .mockResolvedValueOnce({ accessToken: "a1", expiresInSeconds: 1800 })
      .mockResolvedValueOnce({ accessToken: "b1", expiresInSeconds: 1800 })
      .mockResolvedValueOnce({ accessToken: "a2", expiresInSeconds: 1800 });

    const cache = createTokenCache(fetchToken);
    await cache.get("a");
    await cache.get("b");

    cache.clear();
    expect(await cache.get("a")).toBe("a2");
  });

  it("propage les erreurs de fetchToken et permet un retry après échec", async () => {
    const fetchToken = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ accessToken: "tok-1", expiresInSeconds: 1800 });

    const cache = createTokenCache(fetchToken);

    await expect(cache.get("key")).rejects.toThrow("boom");
    expect(await cache.get("key")).toBe("tok-1");
  });

  it("rejette si fetchToken n'est pas une fonction", () => {
    expect(() => createTokenCache(null)).toThrow(/fetchToken/);
  });
});
