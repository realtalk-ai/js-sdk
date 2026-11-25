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

    expect(client.getSnapshot()).toMatchObject({
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

    const before = client.getSnapshot();
    await client.start({ agentId: "agent-1" });

    expect(listener).toHaveBeenCalled();
    expect(client.getSnapshot()).not.toBe(before);
    expect(client.getSnapshot()).toMatchObject({
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

    expect(client.getSnapshot().messages).toEqual([]);
    expect(client.getSnapshot().annotations).toEqual([]);
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

    expect(client.getSnapshot().messages).toEqual([message]);
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
    expect(client.getSnapshot().connectionStatus).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(100);
    expect(transports).toHaveLength(2);
    expect(client.getSnapshot().connectionStatus).toBe("connected");

    transports[1].emit({ type: "close", code: 1006, reason: "" });

    expect(reconnectPolicy.nextRetryDelayMs).toHaveBeenLastCalledWith(
      expect.objectContaining({ retryCount: 0 }),
    );
    expect(client.getSnapshot()).toMatchObject({
      status: "not_started",
      connectionStatus: "disconnected",
    });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ fatal: true }),
    );
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
    expect(client.getSnapshot().connectionStatus).toBe("connected");
  });
});
