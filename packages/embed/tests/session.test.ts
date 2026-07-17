import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSessionMinter,
  fetchEmbedConfig,
  resolveServer,
} from "../src/session.js";

const server = resolveServer("https://api.example.com");

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("resolveServer", () => {
  it("derives REST and WebSocket urls from an https origin", () => {
    expect(resolveServer("https://api.example.com")).toEqual({
      apiBaseUrl: "https://api.example.com/api/v1",
      wsBaseUrl: "wss://api.example.com/api/v1",
    });
  });

  it("uses ws for http origins (local development)", () => {
    expect(resolveServer("http://localhost:8000")).toEqual({
      apiBaseUrl: "http://localhost:8000/api/v1",
      wsBaseUrl: "ws://localhost:8000/api/v1",
    });
  });

  it("keeps a path prefix and strips a trailing slash", () => {
    expect(resolveServer("https://example.com/realtalk/")).toEqual({
      apiBaseUrl: "https://example.com/realtalk/api/v1",
      wsBaseUrl: "wss://example.com/realtalk/api/v1",
    });
  });
});

describe("fetchEmbedConfig", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps the backend fields to camelCase", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          display_name: "Support",
          greeting: "Hi!",
          idle_pause_seconds: 120,
          idle_end_seconds: 600,
        }),
      ),
    );

    await expect(fetchEmbedConfig(server, "agent-1")).resolves.toEqual({
      displayName: "Support",
      greeting: "Hi!",
      idlePauseSeconds: 120,
      idleEndSeconds: 600,
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/embed-configs/agent-1/",
    );
  });

  it("returns null when the origin is rejected (403)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, {})));

    await expect(fetchEmbedConfig(server, "agent-1")).resolves.toBeNull();
  });

  it("returns null when the agent is unknown (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, {})));

    await expect(fetchEmbedConfig(server, "agent-1")).resolves.toBeNull();
  });

  it("throws on unexpected failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));

    await expect(fetchEmbedConfig(server, "agent-1")).rejects.toThrow("500");
  });
});

describe("createSessionMinter", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mints a session, remembers the conversation, and persists it", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(200, { token: "tok-1", conversation_id: "conv-1" }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const minter = createSessionMinter(server, "agent-1");
    expect(minter.conversationId).toBeUndefined();

    await expect(minter.getToken()).resolves.toEqual({
      token: "tok-1",
      conversationId: "conv-1",
    });
    expect(minter.conversationId).toBe("conv-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/embed-sessions/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ agent_id: "agent-1" }),
      }),
    );

    const reloaded = createSessionMinter(server, "agent-1");
    expect(reloaded.conversationId).toBe("conv-1");

    await reloaded.getToken();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://api.example.com/api/v1/embed-sessions/",
      expect.objectContaining({
        body: JSON.stringify({
          agent_id: "agent-1",
          conversation_id: "conv-1",
        }),
      }),
    );
  });

  it("drops a no-longer-resumable conversation and mints a fresh one", async () => {
    sessionStorage.setItem("realtalk-embed:conversation:agent-1", "conv-old");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(409, {}))
      .mockResolvedValueOnce(
        jsonResponse(200, { token: "tok-2", conversation_id: "conv-new" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const minter = createSessionMinter(server, "agent-1");
    expect(minter.conversationId).toBe("conv-old");

    await expect(minter.getToken()).resolves.toEqual({
      token: "tok-2",
      conversationId: "conv-new",
    });
    expect(minter.conversationId).toBe("conv-new");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ agent_id: "agent-1" }),
      }),
    );
    expect(sessionStorage.getItem("realtalk-embed:conversation:agent-1")).toBe(
      "conv-new",
    );
  });

  it("throws when minting fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));

    const minter = createSessionMinter(server, "agent-1");
    await expect(minter.getToken()).rejects.toThrow("500");
  });

  it("reset forgets the conversation in memory and storage", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        jsonResponse(200, { token: "tok-1", conversation_id: "conv-1" }),
      ),
    );

    const minter = createSessionMinter(server, "agent-1");
    await minter.getToken();
    expect(minter.conversationId).toBe("conv-1");

    minter.reset();

    expect(minter.conversationId).toBeUndefined();
    expect(
      sessionStorage.getItem("realtalk-embed:conversation:agent-1"),
    ).toBeNull();
  });

  it("stores conversations per agent", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        jsonResponse(200, { token: "tok-1", conversation_id: "conv-a" }),
      ),
    );

    await createSessionMinter(server, "agent-a").getToken();

    expect(
      createSessionMinter(server, "agent-b").conversationId,
    ).toBeUndefined();
    expect(createSessionMinter(server, "agent-a").conversationId).toBe(
      "conv-a",
    );
  });
});
