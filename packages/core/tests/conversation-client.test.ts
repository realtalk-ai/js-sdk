import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AudioTransport } from "../src/transport.js";
import type { ConversationEvent } from "../src/types.js";
import {
  ConversationClient,
  type ConversationClientCallbacks,
} from "../src/conversation-client.js";
import type { ReconnectPolicy } from "../src/reconnect.js";
import { DEFAULT_WS_URL } from "../src/constants.js";
import { SDK_NAME, SDK_VERSION } from "../src/version.js";

const SDK_INFO = {
  name: "test",
  version: "0.0.0",
  context: "web_chat",
} as const;

function fakeTransport() {
  let emit: (event: ConversationEvent) => void = () => {};
  const transport = {
    status: "disconnected",
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    gracefulDisconnect: vi.fn().mockResolvedValue(undefined),
    sendAudio: vi.fn(),
    sendEvent: vi.fn(),
    onAudio: vi.fn(),
    onEvent: vi.fn((callback: (event: ConversationEvent) => void) => {
      emit = callback;
    }),
    onStatusChange: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  return {
    transport: transport as unknown as AudioTransport & typeof transport,
    emit: (event: ConversationEvent) => emit(event),
  };
}

function validToken(name: string): string {
  const base64Url = (value: string) =>
    btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const exp = Math.floor((Date.now() + 30 * 60 * 1000) / 1000);
  return `${base64Url('{"alg":"HS256"}')}.${base64Url(JSON.stringify({ exp, name }))}.sig`;
}

function scriptedTransports(connectResults: Array<"ok" | "fail" | "hang">) {
  const created: ReturnType<typeof fakeTransport>[] = [];
  const hanging: Array<(error: Error) => void> = [];
  const createTransport = () => {
    const next = fakeTransport();
    const result = connectResults[created.length] ?? "ok";
    if (result === "fail") {
      next.transport.connect.mockRejectedValue(new Error("refused"));
    }
    if (result === "hang") {
      next.transport.connect.mockImplementation(
        () => new Promise<void>((_, reject) => hanging.push(reject)),
      );
    }
    created.push(next);
    return next.transport;
  };
  return { created, hanging, createTransport };
}

function createClient(
  options: {
    callbacks?: ConversationClientCallbacks;
    reconnectPolicy?: ReconnectPolicy;
  } = {},
) {
  const transports: ReturnType<typeof fakeTransport>[] = [];
  const client = new ConversationClient({
    baseUrl: "wss://test.example.com",
    sdkInfo: SDK_INFO,
    getToken: vi
      .fn()
      .mockResolvedValue({ token: "token", conversationId: "c1" }),
    createTransport: () => {
      const created = fakeTransport();
      transports.push(created);
      return created.transport;
    },
    ...options,
  });
  return { client, transports };
}

describe("ConversationClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with an empty, disconnected snapshot", () => {
    const { client } = createClient();

    expect(client.getState()).toMatchObject({
      status: "not_started",
      connectionStatus: "disconnected",
      conversationId: null,
      messages: [],
      annotations: [],
    });
  });

  it("connects to the default server as the core SDK when no baseUrl or sdkInfo is given", async () => {
    const created = fakeTransport();
    const client = new ConversationClient({
      getToken: vi
        .fn()
        .mockResolvedValue({ token: "token", conversationId: "c1" }),
      createTransport: () => created.transport,
    });

    await client.start({ agentId: "agent-1" });

    expect(created.transport.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `${DEFAULT_WS_URL}/ws/conversations/audio/c1/`,
        sdkInfo: { name: SDK_NAME, version: SDK_VERSION, context: "web_chat" },
      }),
    );
  });

  it("notifies subscribers with a new snapshot when it connects, until they unsubscribe", async () => {
    const { client } = createClient();
    const listener = vi.fn();
    const unsubscribe = client.subscribe(listener);

    const before = client.getState();
    await client.start({ agentId: "agent-1" });

    expect(listener).toHaveBeenCalled();
    expect(client.getState()).not.toBe(before);
    expect(client.getState()).toMatchObject({
      status: "active",
      connectionStatus: "connected",
      conversationId: "c1",
    });

    unsubscribe();
    listener.mockClear();
    client.sendMessage("Hej");
    await client.end();
    expect(listener).not.toHaveBeenCalled();
  });

  it("starts a new conversation without the previous one's messages", async () => {
    const { client, transports } = createClient();
    await client.start({ agentId: "agent-1" });
    transports[0].emit({
      type: "message_created",
      data: {
        id: "m1",
        role: "agent",
        text: "Hej",
        createdAt: "2026-01-01T00:00:00Z",
      },
    });
    await client.end();

    await client.start({ agentId: "agent-1" });

    expect(client.getState().messages).toEqual([]);
    expect(client.getState().annotations).toEqual([]);
  });

  it("sends a message only while connected and says whether it did", async () => {
    const { client, transports } = createClient();
    await client.start({ agentId: "agent-1" });

    expect(client.sendMessage("Hej")).toBe(true);
    transports[0].emit({ type: "close", code: 1006, reason: "" });
    expect(client.sendMessage("Är du där?")).toBe(false);

    expect(transports[0].transport.sendEvent).toHaveBeenCalledWith({
      type: "message",
      data: "Hej",
    });
    expect(transports[0].transport.sendEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: "Är du där?" }),
    );
  });

  it("keeps messages in the snapshot and reports each new one", async () => {
    const onMessage = vi.fn();
    const { client, transports } = createClient({ callbacks: { onMessage } });
    await client.start({ agentId: "agent-1" });
    const message = {
      id: "m1",
      role: "agent" as const,
      text: "Hej",
      createdAt: "2026-01-01T00:00:00Z",
    };

    transports[0].emit({ type: "message_created", data: message });

    expect(client.getState().messages).toEqual([message]);
    expect(onMessage).toHaveBeenCalledWith(message);
  });

  it("reconnects with the delays from the given policy and stops when it returns null", async () => {
    const onError = vi.fn();
    const delays = [100, null];
    const reconnectPolicy = {
      nextRetryDelayMs: vi.fn(() => delays.shift() ?? null),
    };
    const { client, transports } = createClient({
      callbacks: { onError },
      reconnectPolicy,
    });
    await client.start({ agentId: "agent-1" });

    transports[0].emit({ type: "close", code: 1006, reason: "" });
    expect(client.getState().connectionStatus).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(100);
    expect(transports).toHaveLength(2);
    expect(client.getState().connectionStatus).toBe("connected");

    transports[1].emit({ type: "close", code: 1006, reason: "" });

    expect(reconnectPolicy.nextRetryDelayMs).toHaveBeenLastCalledWith(
      expect.objectContaining({ retryCount: 0 }),
    );
    expect(client.getState()).toMatchObject({
      status: "not_started",
      connectionStatus: "disconnected",
    });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ fatal: true }),
    );
  });

  it("does not connect when it is disconnected while waiting for the token", async () => {
    let deliverToken!: (token: unknown) => void;
    const { client, transports } = createClient();
    client.configure({
      getToken: () => new Promise((resolve) => (deliverToken = resolve)),
    });

    const starting = client.start({ agentId: "agent-1" });
    client.disconnect();
    deliverToken({ token: "token", conversationId: "c1" });

    await expect(starting).rejects.toThrow("stopped before it connected");
    expect(transports).toHaveLength(0);
    expect(client.getState()).toMatchObject({
      status: "not_started",
      connectionStatus: "disconnected",
    });
  });

  it("opens only one connection when a second start overlaps the first", async () => {
    const deliveries: ((token: unknown) => void)[] = [];
    const { client, transports } = createClient();
    client.configure({
      getToken: () => new Promise((resolve) => deliveries.push(resolve)),
    });

    const first = client.start({ agentId: "agent-1" });
    const second = client.start({ agentId: "agent-1" });
    deliveries.forEach((deliver) =>
      deliver({ token: "token", conversationId: "c1" }),
    );

    await expect(first).rejects.toThrow("stopped before it connected");
    await expect(second).resolves.toBe("c1");
    expect(transports).toHaveLength(1);
  });

  it("can start again after a start that had no conversation id", async () => {
    const getToken = vi.fn().mockResolvedValueOnce({ token: "token" });
    const { createTransport } = scriptedTransports([]);
    const client = new ConversationClient({ getToken, createTransport });

    await expect(client.start({ agentId: "agent-1" })).rejects.toThrow(
      "No conversation ID available",
    );
    expect(client.getState().status).toBe("not_started");

    getToken.mockResolvedValue({ token: "token", conversationId: "c1" });
    await expect(client.start({ agentId: "agent-1" })).resolves.toBe("c1");
  });

  it("leaves the next conversation alone when a start that was ended fails to connect later", async () => {
    const { created, hanging, createTransport } = scriptedTransports([
      "hang",
      "ok",
    ]);
    const client = new ConversationClient({
      getToken: vi.fn().mockResolvedValue({ token: "t", conversationId: "c1" }),
      createTransport,
    });

    const first = client.start({ agentId: "agent-1" });
    await vi.advanceTimersByTimeAsync(0);
    await client.end();
    await client.start({ agentId: "agent-1" });
    hanging[0](new Error("timed out"));
    await expect(first).rejects.toThrow("timed out");

    expect(created[1].transport.disconnect).not.toHaveBeenCalled();
    expect(client.getState()).toMatchObject({
      status: "active",
      connectionStatus: "connected",
    });
  });

  it("ends the conversation instead of reconnecting when reconnectPolicy is null", async () => {
    const statuses: string[] = [];
    const onError = vi.fn();
    const { created, createTransport } = scriptedTransports([]);
    const client = new ConversationClient({
      getToken: vi.fn().mockResolvedValue({ token: "t", conversationId: "c1" }),
      createTransport,
      reconnectPolicy: null,
      callbacks: {
        onError,
        onConnectionStatusChange: (status) => statuses.push(status),
      },
    });
    await client.start({ agentId: "agent-1" });

    created[0].emit({ type: "close", code: 1006, reason: "" });
    await vi.advanceTimersByTimeAsync(30_000);

    expect(created).toHaveLength(1);
    expect(statuses).not.toContain("reconnecting");
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ fatal: true }),
    );
    expect(client.getState()).toMatchObject({
      status: "not_started",
      connectionStatus: "disconnected",
    });
  });

  it("keeps reporting reconnecting while its attempts fail", async () => {
    const statuses: string[] = [];
    const { created, createTransport } = scriptedTransports([
      "ok",
      "fail",
      "fail",
      "ok",
    ]);
    const client = new ConversationClient({
      getToken: vi.fn().mockResolvedValue({ token: "t", conversationId: "c1" }),
      createTransport,
      callbacks: {
        onConnectionStatusChange: (status) => statuses.push(status),
      },
    });
    await client.start({ agentId: "agent-1" });
    statuses.length = 0;

    created[0].emit({ type: "close", code: 1006, reason: "" });
    await vi.advanceTimersByTimeAsync(30_000);

    expect(created).toHaveLength(4);
    expect(statuses[0]).toBe("reconnecting");
    expect(statuses).not.toContain("connecting");
    expect(statuses.at(-1)).toBe("connected");
  });

  it("keeps the token of the start that won when two starts overlap", async () => {
    const firstToken = validToken("first");
    const secondToken = validToken("second");
    const deliveries: Array<(token: unknown) => void> = [];
    const { created, createTransport } = scriptedTransports([]);
    const client = new ConversationClient({
      getToken: () => new Promise((resolve) => deliveries.push(resolve)),
      createTransport,
    });

    const first = client.start({ agentId: "agent-1" });
    const second = client.start({ agentId: "agent-1" });
    deliveries[1]({ token: secondToken, conversationId: "c2" });
    await second;
    deliveries[0]({ token: firstToken, conversationId: "c1" });
    await expect(first).rejects.toThrow("stopped before it connected");

    created[0].emit({ type: "close", code: 1006, reason: "" });
    await vi.advanceTimersByTimeAsync(1000);

    expect(created[1].transport.connect).toHaveBeenCalledWith(
      expect.objectContaining({ token: secondToken }),
    );
  });

  it("keeps reconnecting with its current token when a new one is for another conversation", async () => {
    const current = validToken("current");
    const getToken = vi
      .fn()
      .mockResolvedValueOnce({ token: current, conversationId: "c1" })
      .mockResolvedValue({ token: validToken("other"), conversationId: "c2" });
    const onError = vi.fn();
    const { created, createTransport } = scriptedTransports([
      "ok",
      "fail",
      "ok",
    ]);
    const client = new ConversationClient({
      getToken,
      createTransport,
      callbacks: { onError },
    });
    await client.start({ agentId: "agent-1" });

    created[0].emit({ type: "close", code: 1006, reason: "" });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(getToken).toHaveBeenLastCalledWith({ conversationId: "c1" });
    expect(onError).not.toHaveBeenCalled();
    expect(created[2].transport.connect).toHaveBeenCalledWith(
      expect.objectContaining({ token: current }),
    );
    expect(client.getState()).toMatchObject({
      conversationId: "c1",
      connectionStatus: "connected",
    });
  });

  it("asks the token URL for a token for the same conversation when it renews one", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: "t", conversation_id: "c1" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { created, createTransport } = scriptedTransports(["ok", "fail"]);
    const client = new ConversationClient({
      tokenUrl: "https://example.com/token?site=1",
      createTransport,
    });
    await client.start({ agentId: "agent-1" });

    created[0].emit({ type: "close", code: 1006, reason: "" });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.com/token?site=1",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/token?site=1&conversation_id=c1",
    );
    vi.unstubAllGlobals();
  });

  it("disconnects without ending the conversation, and can start again afterwards", async () => {
    const { client, transports } = createClient();
    await client.start({ agentId: "agent-1" });

    client.disconnect();
    transports[0].emit({ type: "close", code: 1006, reason: "" });
    await vi.advanceTimersByTimeAsync(60_000);

    expect(transports[0].transport.sendEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "end_conversation" }),
    );
    expect(transports).toHaveLength(1);

    await client.start({ agentId: "agent-1" });
    expect(transports).toHaveLength(2);
    expect(client.getState().connectionStatus).toBe("connected");
  });
});
