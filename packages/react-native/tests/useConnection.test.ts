import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ConversationEvent } from "@realtalk-ai/core";
import {
  DEFAULT_CONVERSATION_MODE,
  useConnection,
} from "../src/hooks/useConnection.js";

const AUDIO_BOTH_WAYS = { userAudio: true, agentAudio: true };

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
        mode: AUDIO_BOTH_WAYS,
      });
    });

    expect(mockTransport.connect).toHaveBeenCalled();
    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.status).toBe("active");
    expect(result.current.conversationId).toBe("conv-1");
    expect(id!).toBe("conv-1");
  });

  it("startConversation with text mode connects normally", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
        mode: DEFAULT_CONVERSATION_MODE,
      });
    });

    expect(mockTransport.connect).toHaveBeenCalled();
    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.status).toBe("active");
  });

  it("endConversation sends end_conversation, gracefully disconnects, and sets status to finished", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });
    opts.setMessages.mockClear();

    await act(async () => {
      await result.current.endConversation();
    });

    const transport = vi.mocked(
      (await import("@realtalk-ai/core")).WebSocketTransport,
    ).mock.results[0].value;
    expect(transport.sendEvent).toHaveBeenCalledWith({
      type: "end_conversation",
      data: {},
    });
    expect(transport.removeAllListeners).toHaveBeenCalled();
    expect(transport.gracefulDisconnect).toHaveBeenCalled();
    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.status).toBe("finished");
    expect(result.current.conversationId).toBe("conv-1");
    expect(result.current.error).toBeNull();
    expect(opts.setMessages).not.toHaveBeenCalled();
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
      }),
    );
  });

  it("startConversation connects in the requested conversation mode", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
        mode: AUDIO_BOTH_WAYS,
      });
    });

    expect(mockTransport.connect).toHaveBeenCalledWith(
      expect.objectContaining({ mode: AUDIO_BOTH_WAYS }),
    );
  });

  it("startConversation connects without audio by default", async () => {
    const opts = defaultOpts();
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    expect(mockTransport.connect).toHaveBeenCalledWith(
      expect.objectContaining({ mode: DEFAULT_CONVERSATION_MODE }),
    );
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
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({ agentId: "agent-1" });
    });

    expect(opts.getToken).toHaveBeenCalledTimes(1);

    const { WebSocketTransport } = await import("@realtalk-ai/core");
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
    const { result } = renderHook(() => useConnection(opts));

    await act(async () => {
      await result.current.startConversation({ agentId: "agent-1" });
    });

    const { WebSocketTransport } = await import("@realtalk-ai/core");
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
});
