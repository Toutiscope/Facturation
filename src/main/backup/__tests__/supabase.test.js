import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("electron-log", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { createSupabaseAdapter } = await import("../adapters/supabase.js");

// ── Helpers de réponse fetch ─────────────────────────────────

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    arrayBuffer: async () => Buffer.from(JSON.stringify(body)),
  };
}

function binaryResponse(buf, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({}),
    text: async () => "",
    // Tranche précise : l'ArrayBuffer sous-jacent d'un Buffer Node est mis en pool.
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}

const CONFIG = {
  url: "https://proj.supabase.co",
  anonKey: "anon-key",
  bucket: "backups",
};

let session; // { refreshToken, userId } | null
let saveSession;

function makeAdapter() {
  saveSession = vi.fn(async (s) => {
    session = s;
  });
  return createSupabaseAdapter({
    ...CONFIG,
    getSession: async () => session,
    saveSession,
  });
}

beforeEach(() => {
  session = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("supabase adapter — auth", () => {
  it("signInWithPassword appelle le bon endpoint et persiste la session", async () => {
    const fetchMock = vi.fn(async (url) => {
      expect(url).toBe(
        "https://proj.supabase.co/auth/v1/token?grant_type=password",
      );
      return jsonResponse({
        access_token: "at-1",
        refresh_token: "rt-1",
        expires_in: 3600,
        user: { id: "user-123", email: "a@b.fr" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = makeAdapter();
    const result = await adapter.signInWithPassword("a@b.fr", "pw");

    expect(result).toEqual({ userId: "user-123", email: "a@b.fr" });
    expect(saveSession).toHaveBeenCalledWith({
      refreshToken: "rt-1",
      userId: "user-123",
    });
    // apikey transmis
    expect(fetchMock.mock.calls[0][1].headers.apikey).toBe("anon-key");
  });

  it("signInWithPassword lève une erreur claire sur identifiants invalides", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "invalid" }, 400)),
    );
    const adapter = makeAdapter();
    await expect(adapter.signInWithPassword("a@b.fr", "bad")).rejects.toThrow(
      /connexion Supabase/i,
    );
  });

  it("rafraîchit l'access token via le refresh token et repersiste la rotation", async () => {
    session = { refreshToken: "rt-old", userId: "user-123" };

    const fetchMock = vi.fn(async (url) => {
      if (url.includes("grant_type=refresh_token")) {
        return jsonResponse({
          access_token: "at-2",
          refresh_token: "rt-new", // rotation
          expires_in: 3600,
          user: { id: "user-123" },
        });
      }
      // upload
      return jsonResponse({ Key: "ok" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = makeAdapter();
    await adapter.uploadBackup("backup-x.fbak", Buffer.from("data"));

    // Le refresh token tourné a été repersisté
    expect(saveSession).toHaveBeenCalledWith({
      refreshToken: "rt-new",
      userId: "user-123",
    });
  });

  it("lève NON connecté si aucune session n'existe", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const adapter = makeAdapter();
    await expect(adapter.listBackups()).rejects.toThrow(/Non connecté/i);
  });
});

describe("supabase adapter — storage", () => {
  beforeEach(() => {
    session = { refreshToken: "rt", userId: "user-123" };
  });

  function fetchWithAuth(handler) {
    return vi.fn(async (url, options) => {
      if (url.includes("grant_type=refresh_token")) {
        return jsonResponse({
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3600,
          user: { id: "user-123" },
        });
      }
      return handler(url, options);
    });
  }

  it("uploadBackup écrit sous le préfixe userId avec le header Authorization", async () => {
    const fetchMock = fetchWithAuth((url, options) => {
      expect(url).toBe(
        "https://proj.supabase.co/storage/v1/object/backups/user-123/backup-x.fbak",
      );
      expect(options.method).toBe("POST");
      expect(options.headers.Authorization).toBe("Bearer at");
      expect(options.headers["x-upsert"]).toBe("true");
      return jsonResponse({ Key: "ok" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = makeAdapter();
    const res = await adapter.uploadBackup("backup-x.fbak", Buffer.from("hello"));
    expect(res).toEqual({ name: "backup-x.fbak", size: 5 });
  });

  it("listBackups normalise la réponse et ignore les pseudo-dossiers", async () => {
    const fetchMock = fetchWithAuth((url, options) => {
      expect(url).toBe("https://proj.supabase.co/storage/v1/object/list/backups");
      const body = JSON.parse(options.body);
      expect(body.prefix).toBe("user-123/");
      return jsonResponse([
        {
          name: "backup-2026-07-25T00-00-00-000Z.fbak",
          updated_at: "2026-07-25T00:00:00Z",
          metadata: { size: 42 },
        },
        { name: "sous-dossier/" }, // à ignorer
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = makeAdapter();
    const list = await adapter.listBackups();
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({
      name: "backup-2026-07-25T00-00-00-000Z.fbak",
      updatedAt: "2026-07-25T00:00:00Z",
      size: 42,
    });
  });

  it("removeBackups envoie un DELETE avec les préfixes complets", async () => {
    const fetchMock = fetchWithAuth((url, options) => {
      expect(url).toBe("https://proj.supabase.co/storage/v1/object/backups");
      expect(options.method).toBe("DELETE");
      const body = JSON.parse(options.body);
      expect(body.prefixes).toEqual(["user-123/backup-old.fbak"]);
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = makeAdapter();
    const res = await adapter.removeBackups(["backup-old.fbak"]);
    expect(res).toEqual({ removed: 1 });
  });

  it("removeBackups ne fait aucun appel réseau pour une liste vide", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const adapter = makeAdapter();
    const res = await adapter.removeBackups([]);
    expect(res).toEqual({ removed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("downloadBackup renvoie un Buffer", async () => {
    const payload = Buffer.from([1, 2, 3, 4]);
    const fetchMock = fetchWithAuth(() => binaryResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = makeAdapter();
    const buf = await adapter.downloadBackup("backup-x.fbak");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.equals(payload)).toBe(true);
  });
});
