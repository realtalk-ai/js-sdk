import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ConversationEvent, ConversationMode } from "../src/types.js";
import type { TokenResponse } from "../src/types.js";
import type { SdkInfo } from "../src/transport.js";
import { ApiError } from "../src/errors.js";
import {
  ConversationClient,
  DEFAULT_CONVERSATION_MODE,
  type StartConversationOptions,
} from "../src/conversation-client.js";

const TEXT_ONLY = { userAudio: false, agentAudio: false };
const TEXT_WITH_AGENT_AUDIO = { userAudio: false, agentAudio: true };
const AUDIO_BOTH_WAYS = { userAudio: true, agentAudio: true };

function onTheWire(mode: ConversationMode) {
  return { user_audio: mode.userAudio, agent_audio: mode.agentAudio };
}

const mockTransport = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gracefulDisconnect: vi.fn(),
  sendAudio: vi.fn(),
  sendEvent: vi.fn(),
  onAudio: vi.fn(),
  onEvent: vi.fn(),
  onStatusChange: vi.fn(),
  removeAllListeners: vi.fn(),
};

const WebSocketTransport = vi.fn(() => ({ ...mockTransport }));

const TEST_SDK_INFO: SdkInfo = {
  name: "test",
  version: "0.0.0",
  context: "web_chat",
};

interface TestCallbacks {
  onEvent?: (event: ConversationEvent) => void;
  onError?: (error: unknown) => void;
  onStatusChange?: (status: string) => void;
  onConnectionStatusChange?: (status: string) => void;
}

function defaultOpts() {
  return {
    baseUrl: "wss://test.example.com",
    tokenUrl: null as string | null,
    getToken: null as (() => Promise<TokenResponse>) | null,
    sdkInfo: undefined as SdkInfo | undefined,
    optionsRef: { current: {} as TestCallbacks },
    onAudio: vi.fn(),
    onClear: vi.fn(),
    onCleanup: vi.fn(),
    onModeRefused: vi.fn(),
  };
}

function renderClient(opts: ReturnType<typeof defaultOpts>) {
  const client = new ConversationClient({
    baseUrl: opts.baseUrl,
    tokenUrl: opts.tokenUrl,
    getToken: opts.getToken,
    sdkInfo: opts.sdkInfo ?? TEST_SDK_INFO,
    createTransport: () => WebSocketTransport(),
    callbacks: {
      onEvent: (event) => opts.optionsRef.current.onEvent?.(event),
      onError: (error) => opts.optionsRef.current.onError?.(error),
      onStatusChange: (status) =>
        opts.optionsRef.current.onStatusChange?.(status),
      onConnectionStatusChange: (status) =>
        opts.optionsRef.current.onConnectionStatusChange?.(status),
      onModeRefused: opts.onModeRefused,
      onAudio: opts.onAudio,
      onClear: opts.onClear,
      onCleanup: opts.onCleanup,
    },
  });
  const view = {
    get connectionStatus() {
      return client.getState().connectionStatus;
    },
    get status() {
      return client.getState().status;
    },
    get conversationId() {
      return client.getState().conversationId;
    },
    get error() {
      return client.getState().error;
    },
    get mode() {
      return client.getState().mode;
    },
    get messages() {
      return client.getState().messages;
    },
    startConversation: (options: StartConversationOptions) =>
      client.start(options),
    endConversation: () => client.end(),
    sendMessage: (text: string) => client.sendMessage(text),
    sendDTMF: (digit: Parameters<ConversationClient["sendDTMF"]>[0]) =>
      client.sendDTMF(digit),
    sendEvent: (payload: Parameters<ConversationClient["sendEvent"]>[0]) =>
      client.sendEvent(payload),
    sendAudio: (pcm: Int16Array) => client.sendAudio(pcm),
    requestMode: (mode: ConversationMode) => client.requestMode(mode),
    getMode: client.getMode,
  };
  return { result: { current: view }, unmount: () => client.disconnect() };
}

function act<T>(run: () => T): T {
  return run();
}

const ENDED_STATUS = {
  type: "conversation_status",
  data: { status: "ended" },
} as const;
const IDLE_STATUS = {
  type: "conversation_status",
  data: { status: "idle" },
} as const;

function sessionToken(expiresInMs: number, name = "token"): string {
  const base64Url = (value: string) =>
    btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const exp = Math.floor((Date.now() + expiresInMs) / 1000);
  return `${base64Url('{"alg":"HS256"}')}.${base64Url(JSON.stringify({ exp, name }))}.sig`;
}

describe("ConversationClient, with the cases of the former connection hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport.connect.mockResolvedValue(undefined);
    mockTransport.gracefulDisconnect.mockResolvedValue(undefined);
  });

  it("initial state is not_started and disconnected with no conversation", () => {
    const { result } = renderClient(defaultOpts());

    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.status).toBe("not_started");
    expect(result.current.conversationId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("startConversation connects WS when conversationId provided", async () => {
    const opts = defaultOpts();
    const { result } = renderClient(opts);

    let id: string;
    await act(async () => {
      id = await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    expect(mockTransport.connect).toHaveBeenCalled();
    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.status).toBe("active");
    expect(result.current.conversationId).toBe("conv-1");
    expect(id!).toBe("conv-1");
  });

  it("startConversation uses conversationId from getToken response", async () => {
    const opts = defaultOpts();
    opts.getToken = vi.fn().mockResolvedValue({
      token: "callback-token",
      conversationId: "token-conv-1",
    });
    const { result } = renderClient(opts);

    let id: string;
    await act(async () => {
      id = await result.current.startConversation({ agentId: "agent-1" });
    });

    expect(opts.getToken).toHaveBeenCalled();
    expect(result.current.conversationId).toBe("token-conv-1");
    expect(id!).toBe("token-conv-1");
    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.status).toBe("active");
  });

  it("startConversation uses conversationId from tokenUrl response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            token: "url-token",
            conversation_id: "url-conv-1",
          }),
      }),
    );

    const opts = defaultOpts();
    opts.tokenUrl = "https://example.com/token";
    const { result } = renderClient(opts);

    let id: string;
    await act(async () => {
      id = await result.current.startConversation({ agentId: "agent-1" });
    });

    expect(fetch).toHaveBeenCalledWith("https://example.com/token");
    expect(result.current.conversationId).toBe("url-conv-1");
    expect(id!).toBe("url-conv-1");

    vi.unstubAllGlobals();
  });

  it("startConversation throws when no conversationId available", async () => {
    const opts = defaultOpts();
    opts.getToken = vi.fn().mockResolvedValue("plain-token");
    const { result } = renderClient(opts);

    await expect(
      act(async () => {
        await result.current.startConversation({ agentId: "agent-1" });
      }),
    ).rejects.toThrow("No conversation ID available");
  });

  it("startConversation prefers explicit conversationId over token conversationId", async () => {
    const opts = defaultOpts();
    opts.getToken = vi.fn().mockResolvedValue({
      token: "callback-token",
      conversationId: "token-conv",
    });
    const { result } = renderClient(opts);

    let id: string;
    await act(async () => {
      id = await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "explicit-conv",
      });
    });

    expect(result.current.conversationId).toBe("explicit-conv");
    expect(id!).toBe("explicit-conv");
  });

  it("startConversation throws if already active", async () => {
    const opts = defaultOpts();
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    await expect(
      act(async () => {
        await result.current.startConversation({
          agentId: "agent-1",
          conversationId: "conv-1",
        });
      }),
    ).rejects.toThrow("Conversation already active");
  });

  it("endConversation sends end_conversation, gracefully disconnects, and sets status to finished", async () => {
    const opts = defaultOpts();
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    await act(async () => {
      await result.current.endConversation();
    });

    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    expect(transport.sendEvent).toHaveBeenCalledWith({
      type: "end_conversation",
      data: {},
    });
    expect(transport.removeAllListeners).toHaveBeenCalled();
    expect(transport.gracefulDisconnect).toHaveBeenCalled();
    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.status).toBe("finished");
    expect(result.current.conversationId).toBe("conv-1");
  });

  it("endConversation on a paused conversation sets status to finished without a transport", async () => {
    const opts = defaultOpts();
    opts.getToken = vi.fn().mockResolvedValue({
      token: "token",
      conversationId: "conv-1",
    });
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({ agentId: "agent-1" });
    });
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => {
      onEventCb({ type: "close", code: 4005, reason: "Idle timeout" });
    });
    expect(result.current.status).toBe("paused");
    transport.sendEvent.mockClear();

    await act(async () => {
      await result.current.endConversation();
    });

    expect(transport.sendEvent).not.toHaveBeenCalled();
    expect(result.current.status).toBe("finished");
    expect(result.current.conversationId).toBe("conv-1");
  });

  it("endConversation before any conversation leaves status not_started", async () => {
    const opts = defaultOpts();
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.endConversation();
    });

    expect(result.current.status).toBe("not_started");
    expect(result.current.conversationId).toBeNull();
  });

  it("sendMessage sends message event", async () => {
    const opts = defaultOpts();
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    act(() => result.current.sendMessage("hello"));

    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    expect(transport.sendEvent).toHaveBeenCalledWith({
      type: "message",
      data: "hello",
    });
  });

  it("sendDTMF sends dtmf event", async () => {
    const opts = defaultOpts();
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    act(() => result.current.sendDTMF("5"));

    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    expect(transport.sendEvent).toHaveBeenCalledWith({
      type: "dtmf",
      data: "5",
    });
  });

  it("sendEvent sends custom payload", async () => {
    const opts = defaultOpts();
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    act(() => result.current.sendEvent({ type: "custom", foo: "bar" }));

    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    expect(transport.sendEvent).toHaveBeenCalledWith({
      type: "custom",
      foo: "bar",
    });
  });

  it("transport message events are forwarded via onEvent", async () => {
    const opts = defaultOpts();
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    const event: ConversationEvent = {
      type: "message_created",
      data: {
        id: "msg-1",
        role: "agent",
        text: "hi",
        createdAt: "2024-01-01T00:00:00Z",
      },
    };

    act(() => onEventCb(event));

    expect(result.current.messages).toEqual([event.data]);
  });

  it("transport error event sets error state and calls onError", async () => {
    const opts = defaultOpts();
    const onError = vi.fn();
    opts.optionsRef.current = { onError };
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => onEventCb({ type: "error", message: "Something broke" }));

    expect(result.current.error).not.toBeNull();
    expect(result.current.error!.error.message).toBe("Something broke");
    expect(result.current.error!.fatal).toBe(false);
    expect(onError).toHaveBeenCalled();
  });

  it("transport clear event calls onClear", async () => {
    const opts = defaultOpts();
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => onEventCb({ type: "clear" }));

    expect(opts.onClear).toHaveBeenCalled();
  });

  it("an ended conversation status triggers cleanup and finished status", async () => {
    const opts = defaultOpts();
    const onEvent = vi.fn();
    opts.optionsRef.current = { onEvent };
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => onEventCb(ENDED_STATUS));

    expect(result.current.status).toBe("finished");
    expect(result.current.connectionStatus).toBe("disconnected");
    expect(onEvent).toHaveBeenCalledWith(ENDED_STATUS);
  });

  it("an idle conversation status keeps the conversation active", async () => {
    const opts = defaultOpts();
    const onEvent = vi.fn();
    opts.optionsRef.current = { onEvent };
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => onEventCb(IDLE_STATUS));

    expect(result.current.status).toBe("active");
    expect(result.current.connectionStatus).toBe("connected");
    expect(onEvent).toHaveBeenCalledWith(IDLE_STATUS);
  });

  it("connects on protocol 2", async () => {
    const opts = defaultOpts();
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    expect(transport.connect).toHaveBeenCalledWith(
      expect.objectContaining({ protocol: 2 }),
    );
  });

  it("audio callback forwards data via onAudio", async () => {
    const opts = defaultOpts();
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onAudioCb = transport.onAudio.mock.calls[0][0];

    const pcm = new Int16Array(160);
    await act(async () => {
      onAudioCb(pcm, "trace-1", "user");
    });

    expect(opts.onAudio).toHaveBeenCalledWith(pcm, "trace-1", "user");
  });

  it("startConversation passes token to WS connect", async () => {
    const opts = defaultOpts();
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
        token: "my-token",
      });
    });

    expect(mockTransport.connect).toHaveBeenCalledWith(
      expect.objectContaining({ token: "my-token" }),
    );
  });

  it("startConversation reports the configured sdkInfo override", async () => {
    const sdkInfo = {
      name: "embed",
      version: "9.9.9",
      context: "embed_widget" as const,
    };
    const opts = { ...defaultOpts(), sdkInfo };
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    expect(mockTransport.connect).toHaveBeenCalledWith(
      expect.objectContaining({ sdkInfo }),
    );
  });

  it("startConversation calls onConnectionStatusChange", async () => {
    const opts = defaultOpts();
    const onConnectionStatusChange = vi.fn();
    opts.optionsRef.current = { onConnectionStatusChange };
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    expect(onConnectionStatusChange).toHaveBeenCalledWith("connecting");
    expect(onConnectionStatusChange).toHaveBeenCalledWith("connected");
  });

  it("startConversation calls onStatusChange", async () => {
    const opts = defaultOpts();
    const onStatusChange = vi.fn();
    opts.optionsRef.current = { onStatusChange };
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    expect(onStatusChange).toHaveBeenCalledWith("active");
  });

  it("startConversation sends start event with agentId", async () => {
    const opts = defaultOpts();
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    expect(transport.sendEvent).toHaveBeenCalledWith({
      type: "start",
      agent_id: "agent-1",
    });
  });

  it("startConversation cleans up on WS connect failure", async () => {
    mockTransport.connect.mockRejectedValueOnce(new Error("WS failed"));

    const opts = defaultOpts();
    const { result } = renderClient(opts);

    await expect(
      act(async () => {
        await result.current.startConversation({
          agentId: "agent-1",
          conversationId: "conv-1",
        });
      }),
    ).rejects.toThrow("WS failed");

    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.status).toBe("not_started");
  });

  it("startConversation prefers direct token over getToken callback", async () => {
    const opts = defaultOpts();
    opts.getToken = vi.fn().mockResolvedValue({
      token: "callback-token",
      conversationId: "conv-1",
    });
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
        token: "direct-token",
      });
    });

    expect(opts.getToken).not.toHaveBeenCalled();
    expect(mockTransport.connect).toHaveBeenCalledWith(
      expect.objectContaining({ token: "direct-token" }),
    );
  });

  it("startConversation prefers getToken callback over tokenUrl", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "url-token" }),
      }),
    );

    const opts = defaultOpts();
    opts.tokenUrl = "https://example.com/token";
    opts.getToken = vi.fn().mockResolvedValue({
      token: "callback-token",
      conversationId: "conv-1",
    });
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({ agentId: "agent-1" });
    });

    expect(opts.getToken).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("startConversation falls back to tokenUrl when no token or getToken", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            token: "url-token",
            conversation_id: "url-conv-1",
          }),
      }),
    );

    const opts = defaultOpts();
    opts.tokenUrl = "https://example.com/token";
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({ agentId: "agent-1" });
    });

    expect(fetch).toHaveBeenCalledWith("https://example.com/token");
    expect(result.current.conversationId).toBe("url-conv-1");

    vi.unstubAllGlobals();
  });

  it("reconnect refreshes token via getToken before connecting", async () => {
    vi.useFakeTimers();

    const opts = defaultOpts();
    let callCount = 0;
    opts.getToken = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        token: `token-${callCount}`,
        conversationId: "conv-reconnect",
      });
    });
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({ agentId: "agent-1" });
    });

    expect(opts.getToken).toHaveBeenCalledTimes(1);
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => {
      onEventCb({ type: "close", code: 1006, reason: "" });
    });

    expect(result.current.connectionStatus).toBe("reconnecting");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(opts.getToken).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("reconnect refreshes token via tokenUrl before connecting", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          token: "refreshed-url-token",
          conversation_id: "conv-url-reconnect",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const opts = defaultOpts();
    opts.tokenUrl = "https://example.com/token";
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({ agentId: "agent-1" });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => {
      onEventCb({ type: "close", code: 1006, reason: "" });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("non-reconnectable close code sets fatal error and resets status", async () => {
    const opts = defaultOpts();
    const onError = vi.fn();
    opts.optionsRef.current = { onError };
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => {
      onEventCb({ type: "close", code: 4002, reason: "Invalid context" });
    });

    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.status).toBe("not_started");
    expect(result.current.error).not.toBeNull();
    expect(result.current.error!.fatal).toBe(true);
    expect(onError).toHaveBeenCalled();
  });

  it("reconnectable close code 1008 triggers reconnection", async () => {
    vi.useFakeTimers();

    const opts = defaultOpts();
    opts.getToken = vi.fn().mockResolvedValue({
      token: "token",
      conversationId: "conv-1",
    });
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({ agentId: "agent-1" });
    });
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => {
      onEventCb({ type: "close", code: 1008, reason: "Service is updating" });
    });

    expect(result.current.connectionStatus).toBe("reconnecting");

    vi.useRealTimers();
  });

  describe("reconnecting", () => {
    async function startAndDropConnection(
      opts: ReturnType<typeof defaultOpts>,
      sessionOptions: StartConversationOptions = { agentId: "agent-1" },
    ) {
      const rendered = renderClient(opts);
      await act(async () => {
        await rendered.result.current.startConversation(sessionOptions);
      });
      const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
      const onEventCb = transport.onEvent.mock.calls[0][0];
      act(() => {
        onEventCb({ type: "close", code: 1012, reason: "Service restart" });
      });
      return rendered;
    }

    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(1);
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.mocked(Math.random).mockRestore();
    });

    it("waits a random part of the planned delay, at least half of it", async () => {
      vi.mocked(Math.random).mockReturnValue(0);
      const opts = defaultOpts();
      opts.getToken = vi.fn().mockResolvedValue({
        token: "token",
        conversationId: "conv-1",
      });
      await startAndDropConnection(opts);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(499);
      });
      expect(opts.getToken).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(opts.getToken).toHaveBeenCalledTimes(2);
    });

    it("reconnects with the token it has while it is valid for more than a minute", async () => {
      const opts = defaultOpts();
      const token = sessionToken(30 * 60 * 1000);
      opts.getToken = vi
        .fn()
        .mockResolvedValue({ token, conversationId: "conv-1" });
      const { result } = await startAndDropConnection(opts);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(opts.getToken).toHaveBeenCalledTimes(1);
      expect(mockTransport.connect).toHaveBeenCalledTimes(2);
      expect(mockTransport.connect).toHaveBeenLastCalledWith(
        expect.objectContaining({ token }),
      );
      expect(result.current.connectionStatus).toBe("connected");
    });

    it("fetches a new token when the one it has expires within a minute", async () => {
      const opts = defaultOpts();
      const renewed = sessionToken(30 * 60 * 1000, "renewed");
      opts.getToken = vi
        .fn()
        .mockResolvedValueOnce({
          token: sessionToken(30 * 1000),
          conversationId: "conv-1",
        })
        .mockResolvedValue({ token: renewed, conversationId: "conv-1" });
      await startAndDropConnection(opts);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(opts.getToken).toHaveBeenCalledTimes(2);
      expect(mockTransport.connect).toHaveBeenLastCalledWith(
        expect.objectContaining({ token: renewed }),
      );
    });

    it("fetches a new token after an attempt with the one it has fails", async () => {
      const opts = defaultOpts();
      const first = sessionToken(30 * 60 * 1000, "first");
      const renewed = sessionToken(30 * 60 * 1000, "renewed");
      opts.getToken = vi
        .fn()
        .mockResolvedValueOnce({ token: first, conversationId: "conv-1" })
        .mockResolvedValue({ token: renewed, conversationId: "conv-1" });
      const { result } = await startAndDropConnection(opts);
      mockTransport.connect.mockRejectedValueOnce(
        new Error("handshake refused"),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(opts.getToken).toHaveBeenCalledTimes(1);
      expect(mockTransport.connect).toHaveBeenLastCalledWith(
        expect.objectContaining({ token: first }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(opts.getToken).toHaveBeenCalledTimes(2);
      expect(mockTransport.connect).toHaveBeenLastCalledWith(
        expect.objectContaining({ token: renewed }),
      );
      expect(result.current.connectionStatus).toBe("connected");
    });

    it("keeps retrying every 5 seconds after the first attempts fail", async () => {
      const opts = defaultOpts();
      opts.getToken = vi.fn().mockResolvedValue({
        token: "token",
        conversationId: "conv-1",
      });
      const { result } = await startAndDropConnection(opts);
      mockTransport.connect.mockRejectedValue(new Error("unreachable"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 5000 * 3);
      });

      expect(mockTransport.connect).toHaveBeenCalledTimes(1 + 6);
      expect(result.current.connectionStatus).toBe("reconnecting");
      expect(result.current.error).toBeNull();
    });

    it("gives up and reports a fatal error after 5 minutes of reconnecting", async () => {
      const opts = defaultOpts();
      const onError = vi.fn();
      opts.optionsRef.current = { onError };
      opts.getToken = vi.fn().mockResolvedValue({
        token: "token",
        conversationId: "conv-1",
      });
      const { result } = await startAndDropConnection(opts);
      mockTransport.connect.mockRejectedValue(new Error("unreachable"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 1);
      });
      expect(result.current.connectionStatus).toBe("reconnecting");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      const attemptsWhenGivingUp = mockTransport.connect.mock.calls.length;

      expect(result.current.status).toBe("not_started");
      expect(result.current.connectionStatus).toBe("disconnected");
      expect(result.current.error?.fatal).toBe(true);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ fatal: true }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });
      expect(mockTransport.connect).toHaveBeenCalledTimes(attemptsWhenGivingUp);
    });

    it("stays disconnected when the conversation is ended while a reconnect attempt is connecting and that attempt fails", async () => {
      const opts = defaultOpts();
      opts.getToken = vi.fn().mockResolvedValue({
        token: "token",
        conversationId: "conv-1",
      });
      const { result } = await startAndDropConnection(opts);
      let failAttempt!: (error: Error) => void;
      mockTransport.connect.mockImplementationOnce(
        () => new Promise((_, reject) => (failAttempt = reject)),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      await act(async () => {
        await result.current.endConversation();
      });
      await act(async () => {
        failAttempt(new Error("timed out"));
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(result.current.status).toBe("finished");
      expect(result.current.connectionStatus).toBe("disconnected");
      expect(mockTransport.connect).toHaveBeenCalledTimes(2);
    });

    it("opens no connection when the conversation is ended while a new token is fetched", async () => {
      const opts = defaultOpts();
      let deliverToken!: (token: unknown) => void;
      opts.getToken = vi
        .fn()
        .mockResolvedValueOnce({ token: "token", conversationId: "conv-1" })
        .mockImplementationOnce(
          () => new Promise((resolve) => (deliverToken = resolve)),
        );
      const { result } = await startAndDropConnection(opts);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(opts.getToken).toHaveBeenCalledTimes(2);

      await act(async () => {
        await result.current.endConversation();
      });
      await act(async () => {
        deliverToken({ token: "token-2", conversationId: "conv-1" });
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(mockTransport.connect).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe("finished");
      expect(result.current.connectionStatus).toBe("disconnected");
    });

    it("stops and reports the error when the token is refused", async () => {
      const opts = defaultOpts();
      const onError = vi.fn();
      opts.optionsRef.current = { onError };
      const refused = new ApiError(403, "Cannot resume");
      opts.getToken = vi
        .fn()
        .mockResolvedValueOnce({ token: "token", conversationId: "conv-1" })
        .mockRejectedValue(refused);
      const { result } = await startAndDropConnection(opts);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(result.current.status).toBe("not_started");
      expect(result.current.connectionStatus).toBe("disconnected");
      expect(result.current.error).toMatchObject({
        error: refused,
        fatal: true,
      });
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ error: refused }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });
      expect(opts.getToken).toHaveBeenCalledTimes(2);
    });

    it("keeps retrying when the token request is rate limited", async () => {
      const opts = defaultOpts();
      opts.getToken = vi
        .fn()
        .mockResolvedValueOnce({ token: "token", conversationId: "conv-1" })
        .mockRejectedValueOnce(new ApiError(429, "Too many requests"))
        .mockResolvedValue({ token: "token-2", conversationId: "conv-1" });
      const { result } = await startAndDropConnection(opts);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000 + 2000);
      });

      expect(mockTransport.connect).toHaveBeenCalledTimes(2);
      expect(mockTransport.connect).toHaveBeenLastCalledWith(
        expect.objectContaining({ token: "token-2" }),
      );
      expect(result.current.connectionStatus).toBe("connected");
    });

    it("stops when the refreshed token is for another conversation", async () => {
      const opts = defaultOpts();
      opts.getToken = vi
        .fn()
        .mockResolvedValueOnce({ token: "token", conversationId: "conv-1" })
        .mockResolvedValue({ token: "token-2", conversationId: "conv-2" });
      const { result } = await startAndDropConnection(opts);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(mockTransport.connect).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe("not_started");
      expect(result.current.error?.fatal).toBe(true);
    });

    it("refreshes a session token passed with the session through the session's getToken", async () => {
      const opts = defaultOpts();
      opts.getToken = vi.fn().mockResolvedValue("provider-token");
      const sessionGetToken = vi.fn().mockResolvedValue("session-token-2");
      await startAndDropConnection(opts, {
        agentId: "agent-1",
        conversationId: "conv-1",
        token: "session-token-1",
        getToken: sessionGetToken,
      });
      expect(mockTransport.connect).toHaveBeenLastCalledWith(
        expect.objectContaining({ token: "session-token-1" }),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(sessionGetToken).toHaveBeenCalledTimes(1);
      expect(opts.getToken).not.toHaveBeenCalled();
      expect(mockTransport.connect).toHaveBeenLastCalledWith(
        expect.objectContaining({ token: "session-token-2" }),
      );
    });
  });

  it("paused close code 4005 sets status to paused, keeps the conversation id, and does not reconnect", async () => {
    vi.useFakeTimers();

    const opts = defaultOpts();
    const onError = vi.fn();
    const onStatusChange = vi.fn();
    opts.optionsRef.current = { onError, onStatusChange };
    opts.getToken = vi.fn().mockResolvedValue({
      token: "token",
      conversationId: "conv-1",
    });
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({ agentId: "agent-1" });
    });

    expect(opts.getToken).toHaveBeenCalledTimes(1);
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => {
      onEventCb({ type: "close", code: 4005, reason: "Idle timeout" });
    });

    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.status).toBe("paused");
    expect(result.current.conversationId).toBe("conv-1");
    expect(result.current.error).toBeNull();
    expect(onError).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenLastCalledWith("paused");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(opts.getToken).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("startConversation resumes a paused conversation", async () => {
    const opts = defaultOpts();
    opts.getToken = vi.fn().mockResolvedValue({
      token: "token",
      conversationId: "conv-1",
    });
    const { result } = renderClient(opts);

    await act(async () => {
      await result.current.startConversation({ agentId: "agent-1" });
    });
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => {
      onEventCb({ type: "close", code: 4005, reason: "Idle timeout" });
    });
    expect(result.current.status).toBe("paused");

    await act(async () => {
      await result.current.startConversation({ agentId: "agent-1" });
    });

    expect(result.current.status).toBe("active");
    expect(result.current.conversationId).toBe("conv-1");
    expect(opts.getToken).toHaveBeenCalledTimes(2);
    expect(vi.mocked(WebSocketTransport).mock.results).toHaveLength(2);
  });
  describe("conversation mode", () => {
    async function startedConnection(mode?: ConversationMode) {
      const opts = defaultOpts();
      const rendered = renderClient(opts);
      await act(async () => {
        await rendered.result.current.startConversation({
          agentId: "agent-1",
          conversationId: "conv-1",
          mode,
        });
      });
      const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
      const emit = transport.onEvent.mock.calls[0][0] as (
        event: ConversationEvent,
      ) => void;
      return { ...rendered, opts, transport, emit };
    }

    it("connects in the requested mode", async () => {
      const { result, transport } = await startedConnection(
        TEXT_WITH_AGENT_AUDIO,
      );

      expect(transport.connect).toHaveBeenCalledWith(
        expect.objectContaining({ mode: TEXT_WITH_AGENT_AUDIO }),
      );
      expect(result.current.mode).toEqual(TEXT_WITH_AGENT_AUDIO);
    });

    it("connects in the default mode when none is given", async () => {
      const { result, transport } = await startedConnection();

      expect(transport.connect).toHaveBeenCalledWith(
        expect.objectContaining({ mode: DEFAULT_CONVERSATION_MODE }),
      );
      expect(result.current.mode).toEqual(DEFAULT_CONVERSATION_MODE);
    });

    it("requestMode asks the server and adopts the confirmed mode", async () => {
      const { result, transport, emit, opts } =
        await startedConnection(TEXT_ONLY);

      act(() => result.current.requestMode(TEXT_WITH_AGENT_AUDIO));
      expect(transport.sendEvent).toHaveBeenCalledWith({
        type: "set_conversation_mode",
        data: { user_audio: false, agent_audio: true },
      });
      expect(result.current.mode).toEqual(TEXT_ONLY);

      act(() =>
        emit({
          type: "conversation_mode",
          data: onTheWire(TEXT_WITH_AGENT_AUDIO),
        }),
      );

      expect(result.current.mode).toEqual(TEXT_WITH_AGENT_AUDIO);
      expect(result.current.getMode()).toEqual(TEXT_WITH_AGENT_AUDIO);
      expect(opts.onModeRefused).not.toHaveBeenCalled();
    });

    it("keeps the mode and reports an error when the server refuses", async () => {
      const { result, emit, opts } = await startedConnection(TEXT_ONLY);

      act(() => result.current.requestMode(AUDIO_BOTH_WAYS));
      act(() =>
        emit({ type: "conversation_mode", data: onTheWire(TEXT_ONLY) }),
      );

      expect(result.current.mode).toEqual(TEXT_ONLY);
      expect(opts.onModeRefused).toHaveBeenCalledWith(
        AUDIO_BOTH_WAYS,
        TEXT_ONLY,
      );
      expect(result.current.error?.fatal).toBe(false);
    });

    it("keeps the same mode object when the server confirms the current mode", async () => {
      const { result, emit } = await startedConnection(TEXT_ONLY);
      const modeBefore = result.current.mode;

      act(() =>
        emit({ type: "conversation_mode", data: onTheWire(TEXT_ONLY) }),
      );

      expect(result.current.mode).toBe(modeBefore);
    });

    it("requestMode does nothing without a connection", () => {
      const { result } = renderClient(defaultOpts());

      act(() => result.current.requestMode(AUDIO_BOTH_WAYS));

      expect(mockTransport.sendEvent).not.toHaveBeenCalled();
    });
  });
});
