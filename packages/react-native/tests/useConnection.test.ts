import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ConversationEvent } from "@realtalk-ai/core";
import { useConnection } from "../src/hooks/useConnection.js";

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  PermissionsAndroid: {
    request: vi.fn().mockResolvedValue("granted"),
    PERMISSIONS: { RECORD_AUDIO: "android.permission.RECORD_AUDIO" },
    RESULTS: { GRANTED: "granted" },
  },
  NativeModules: {
    RealTalkAudio: {
      initialize: vi.fn().mockResolvedValue(undefined),
      startRecording: vi.fn().mockResolvedValue(undefined),
      stopRecording: vi.fn().mockResolvedValue(undefined),
      playAudio: vi.fn().mockResolvedValue(undefined),
      stopPlayback: vi.fn().mockResolvedValue(undefined),
      setVolume: vi.fn().mockResolvedValue(undefined),
      setMuted: vi.fn().mockResolvedValue(undefined),
      tearDown: vi.fn().mockResolvedValue(undefined),
    },
  },
  NativeEventEmitter: vi.fn(() => ({
    addListener: vi.fn(() => ({ remove: vi.fn() })),
  })),
}));

vi.mock("../src/native/AudioEngineModule.js", () => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  startRecording: vi.fn().mockResolvedValue(undefined),
  stopRecording: vi.fn().mockResolvedValue(undefined),
  playAudio: vi.fn().mockResolvedValue(undefined),
  stopPlayback: vi.fn().mockResolvedValue(undefined),
  setVolume: vi.fn().mockResolvedValue(undefined),
  setMuted: vi.fn().mockResolvedValue(undefined),
  tearDown: vi.fn().mockResolvedValue(undefined),
  onMicrophoneData: vi.fn(() => vi.fn()),
}));

const mockTransport = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gracefulDisconnect: vi.fn(),
  sendAudio: vi.fn(),
  sendEvent: vi.fn(),
  onAudio: vi.fn(),
  onEvent: vi.fn(),
  removeAllListeners: vi.fn(),
};

const mockPlayer = {
  play: vi.fn(),
  clear: vi.fn(),
  stop: vi.fn(),
  setVolume: vi.fn(),
};

const mockRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  setMuted: vi.fn(),
};

vi.mock("@realtalk-ai/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@realtalk-ai/core")>();
  return {
    ...actual,
    WebSocketTransport: vi.fn(() => ({ ...mockTransport })),
  };
});

vi.mock("../src/audio/player.js", () => ({
  AudioPlayer: vi.fn(() => ({ ...mockPlayer })),
}));

vi.mock("../src/audio/recorder.js", () => ({
  AudioRecorder: vi.fn(() => ({ ...mockRecorder })),
}));

function defaultOpts() {
  return {
    baseUrl: "wss://test.example.com",
    tokenUrl: null as string | null,
    getToken: null as (() => Promise<string>) | null,
    optionsRef: { current: {} },
    onEvent: vi.fn(),
    setMessages: vi.fn(),
    onAudio: vi.fn(),
    onClear: vi.fn(),
    onCleanup: vi.fn(),
  };
}

describe("useConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport.connect.mockResolvedValue(undefined);
    mockTransport.gracefulDisconnect.mockResolvedValue(undefined);
    mockRecorder.start.mockResolvedValue(undefined);
  });

  it("initial state is not_started and disconnected with no conversation", () => {
    const { result } = renderHook(() => useConnection(defaultOpts()));

    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.status).toBe("not_started");
    expect(result.current.conversationId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("startConversation connects WS when conversationId provided", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    let id: string;
    await act(async () => {
      id = await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
        mode: "voice",
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
    const { result } = renderHook(() => useConnection(opts));

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
      })
    );

    const opts = defaultOpts();
    opts.tokenUrl = "https://example.com/token";
    const { result } = renderHook(() => useConnection(opts));

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
    const { result } = renderHook(() => useConnection(opts));

    await expect(
      act(async () => {
        await result.current.startConversation({ agentId: "agent-1" });
      })
    ).rejects.toThrow("No conversation ID available");
  });

  it("startConversation prefers explicit conversationId over token conversationId", async () => {
    const opts = defaultOpts();
    opts.getToken = vi.fn().mockResolvedValue({
      token: "callback-token",
      conversationId: "token-conv",
    });
    const { result } = renderHook(() => useConnection(opts));

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

  it("startConversation with text mode connects normally", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
        mode: "text",
      });
    });

    expect(mockTransport.connect).toHaveBeenCalled();
    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.status).toBe("active");
  });

  it("startConversation throws if already active", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

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
      })
    ).rejects.toThrow("Conversation already active");
  });

  it("endConversation sends end_conversation and hangup, gracefully disconnects, and sets status to not_started", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    await act(async () => {
      await result.current.endConversation();
    });

    const transport = vi.mocked(
      (await import("@realtalk-ai/core")).WebSocketTransport
    ).mock.results[0].value;
    expect(transport.sendEvent).toHaveBeenCalledWith({
      type: "end_conversation",
      data: {},
    });
    expect(transport.sendEvent).toHaveBeenCalledWith({
      type: "hangup",
      data: {},
    });
    expect(transport.removeAllListeners).toHaveBeenCalled();
    expect(transport.gracefulDisconnect).toHaveBeenCalled();
    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.status).toBe("not_started");
    expect(result.current.conversationId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("sendMessage sends message event", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    act(() => result.current.sendMessage("hello"));

    const transport = vi.mocked(
      (await import("@realtalk-ai/core")).WebSocketTransport
    ).mock.results[0].value;
    expect(transport.sendEvent).toHaveBeenCalledWith({
      type: "message",
      data: "hello",
    });
  });

  it("sendDTMF sends dtmf event", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    act(() => result.current.sendDTMF("5"));

    const transport = vi.mocked(
      (await import("@realtalk-ai/core")).WebSocketTransport
    ).mock.results[0].value;
    expect(transport.sendEvent).toHaveBeenCalledWith({
      event: "dtmf",
      data: "5",
    });
  });

  it("sendEvent sends custom payload", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    act(() => result.current.sendEvent({ type: "custom", foo: "bar" }));

    const transport = vi.mocked(
      (await import("@realtalk-ai/core")).WebSocketTransport
    ).mock.results[0].value;
    expect(transport.sendEvent).toHaveBeenCalledWith({
      type: "custom",
      foo: "bar",
    });
  });

  it("transport message events are forwarded via onEvent", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    const { WebSocketTransport } = await import("@realtalk-ai/core");
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

    expect(opts.onEvent).toHaveBeenCalledWith(event);
  });

  it("transport error event sets error state and calls onError", async () => {
    const opts = defaultOpts();
    const onError = vi.fn();
    opts.optionsRef.current = { onError };
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => onEventCb({ type: "error", message: "Something broke" }));

    expect(result.current.error).not.toBeNull();
    expect(result.current.error!.error.message).toBe("Something broke");
    expect(result.current.error!.fatal).toBe(false);
    expect(onError).toHaveBeenCalled();
  });

  it("transport clear event calls onClear callback", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => onEventCb({ type: "clear" }));

    expect(opts.onClear).toHaveBeenCalled();
  });

  it("transport conversation_finished event triggers cleanup and finished status", async () => {
    const opts = defaultOpts();
    const onEvent = vi.fn();
    opts.optionsRef.current = { onEvent };
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => onEventCb({ type: "conversation_finished" }));

    expect(result.current.status).toBe("finished");
    expect(result.current.connectionStatus).toBe("disconnected");
    expect(onEvent).toHaveBeenCalledWith({ type: "conversation_finished" });
  });

  it("audio callback forwards data to onAudio", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onAudioCb = transport.onAudio.mock.calls[0][0];

    const pcm = new Int16Array(160);
    await act(async () => {
      onAudioCb(pcm, "trace-1");
    });

    expect(opts.onAudio).toHaveBeenCalledWith(pcm, "trace-1");
  });

  it("startConversation passes token to WS connect", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
        token: "my-token",
      });
    });

    expect(mockTransport.connect).toHaveBeenCalledWith(
      expect.objectContaining({ token: "my-token" })
    );
  });

  it("startConversation calls onConnectionStatusChange", async () => {
    const opts = defaultOpts();
    const onConnectionStatusChange = vi.fn();
    opts.optionsRef.current = { onConnectionStatusChange };
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    expect(onConnectionStatusChange).toHaveBeenCalledWith("connecting");
    expect(onConnectionStatusChange).toHaveBeenCalledWith("connected");
  });

  it("startConversation sends start event with agentId", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    expect(transport.sendEvent).toHaveBeenCalledWith({
      type: "start",
      agent_id: "agent-1",
    });
  });

  it("sendAudio forwards to transport.sendAudio", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    const pcm = new Int16Array(320);
    act(() => result.current.sendAudio(pcm));

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    expect(transport.sendAudio).toHaveBeenCalledWith(pcm);
  });

  it("endConversation calls onCleanup", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    await act(async () => {
      await result.current.endConversation();
    });

    expect(opts.onCleanup).toHaveBeenCalled();
  });

  it("startConversation cleans up on WS connect failure", async () => {
    mockTransport.connect.mockRejectedValueOnce(new Error("WS failed"));

    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await expect(
      act(async () => {
        await result.current.startConversation({
          agentId: "agent-1",
          conversationId: "conv-1",
        });
      })
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
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
        token: "direct-token",
      });
    });

    expect(opts.getToken).not.toHaveBeenCalled();
    expect(mockTransport.connect).toHaveBeenCalledWith(
      expect.objectContaining({ token: "direct-token" })
    );
  });

  it("startConversation prefers getToken callback over tokenUrl", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "url-token" }),
      })
    );

    const opts = defaultOpts();
    opts.tokenUrl = "https://example.com/token";
    opts.getToken = vi.fn().mockResolvedValue({
      token: "callback-token",
      conversationId: "conv-1",
    });
    const { result } = renderHook(() => useConnection(opts));

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
      })
    );

    const opts = defaultOpts();
    opts.tokenUrl = "https://example.com/token";
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({ agentId: "agent-1" });
    });

    expect(fetch).toHaveBeenCalledWith("https://example.com/token");
    expect(result.current.conversationId).toBe("url-conv-1");

    vi.unstubAllGlobals();
  });

  it("startConversation passes sdkInfo to transport.connect", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    expect(mockTransport.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        sdkInfo: {
          name: "react-native",
          version: expect.any(String),
          context: "mobile_app",
        },
      })
    );
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
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({ agentId: "agent-1" });
    });

    expect(opts.getToken).toHaveBeenCalledTimes(1);

    const { WebSocketTransport } = await import("@realtalk-ai/core");
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
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({ agentId: "agent-1" });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const { WebSocketTransport } = await import("@realtalk-ai/core");
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
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    const { WebSocketTransport } = await import("@realtalk-ai/core");
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
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({ agentId: "agent-1" });
    });

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => {
      onEventCb({ type: "close", code: 1008, reason: "Service is updating" });
    });

    expect(result.current.connectionStatus).toBe("reconnecting");

    vi.useRealTimers();
  });
});
