import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { RealTalkProvider } from "../src/provider.js";
import { useConversation } from "../src/useConversation.js";

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

function wrapper({ children }: { children: ReactNode }) {
  return (
    <RealTalkProvider baseUrl="wss://test.example.com">
      {children}
    </RealTalkProvider>
  );
}

describe("useConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport.connect.mockResolvedValue(undefined);
    mockTransport.gracefulDisconnect.mockResolvedValue(undefined);
    mockRecorder.start.mockResolvedValue(undefined);
  });

  it("returns initial idle state", () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.status).toBe("not_started");
    expect(result.current.conversationId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.agentState).toBe("idle");
    expect(result.current.userState).toBe("idle");
    expect(result.current.isMicMuted).toBe(false);
    expect(result.current.isAudioMuted).toBe(false);
    expect(result.current.volume).toBe(1);
  });

  it("throws when used outside RealTalkProvider", () => {
    expect(() => {
      renderHook(() => useConversation());
    }).toThrow("useConversation must be used within RealTalkProvider");
  });

  it("startConversation connects and updates status", async () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.status).toBe("active");
    expect(result.current.conversationId).toBe("conv-1");
  });

  it("endConversation disconnects", async () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    await act(async () => {
      await result.current.endConversation();
    });

    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.status).toBe("not_started");
  });

  it("sendMessage delegates to transport", async () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    act(() => result.current.sendMessage("hello"));

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    expect(transport.sendEvent).toHaveBeenCalledWith({
      type: "message",
      data: "hello",
    });
  });

  it("setVolume updates volume and delegates to player", async () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    act(() => result.current.setVolume(0.5));

    expect(result.current.volume).toBe(0.5);
  });

  it("toggleMic flips mic mute state", async () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
        mode: "voice",
      });
    });

    act(() => result.current.toggleMic());

    expect(result.current.isMicMuted).toBe(true);

    act(() => result.current.toggleMic());

    expect(result.current.isMicMuted).toBe(false);
  });

  it("agentState reflects thinking message state", async () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() =>
      onEventCb({
        type: "message_created",
        data: {
          id: "msg-think",
          role: "agent",
          text: "",
          createdAt: "2024-01-01T00:00:00Z",
        },
      })
    );

    expect(result.current.agentState).toBe("thinking");

    act(() =>
      onEventCb({
        type: "message_updated",
        data: {
          id: "msg-think",
          role: "agent",
          text: "Done thinking",
          createdAt: "2024-01-01T00:00:00Z",
        },
      })
    );

    expect(result.current.agentState).toBe("idle");
  });

  it("message events update messages array", async () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() =>
      onEventCb({
        type: "message_created",
        data: {
          id: "msg-1",
          role: "agent",
          text: "Hello!",
          createdAt: "2024-01-01T00:00:00Z",
        },
      })
    );

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe("Hello!");
  });

  it("vad events update userState", async () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => onEventCb({ type: "vad", data: { state: "speech" } }));
    expect(result.current.userState).toBe("speaking");

    act(() => onEventCb({ type: "vad", data: { state: "silence" } }));
    expect(result.current.userState).toBe("idle");
  });

  it("onMessage callback is invoked for message events", async () => {
    const onMessage = vi.fn();

    const { result } = renderHook(() => useConversation({ onMessage }), {
      wrapper,
    });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() =>
      onEventCb({
        type: "message_created",
        data: {
          id: "msg-1",
          role: "user",
          text: "Hi",
          createdAt: "2024-01-01T00:00:00Z",
        },
      })
    );
    expect(onMessage).toHaveBeenCalled();
  });

  it("onEvent callback fires for all transport events", async () => {
    const onEvent = vi.fn();

    const { result } = renderHook(() => useConversation({ onEvent }), {
      wrapper,
    });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    const onEventCb = transport.onEvent.mock.calls[0][0];

    act(() => onEventCb({ type: "vad", data: { state: "speech" } }));
    expect(onEvent).toHaveBeenCalledWith({
      type: "vad",
      data: { state: "speech" },
    });
  });

  it("endConversation sends hangup event", async () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    await act(async () => {
      await result.current.endConversation();
    });

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    expect(transport.sendEvent).toHaveBeenCalledWith({
      type: "hangup",
      data: {},
    });
    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.status).toBe("not_started");
  });

  it("sendDTMF sends dtmf event", async () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    act(() => result.current.sendDTMF("9"));

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    expect(transport.sendEvent).toHaveBeenCalledWith({
      event: "dtmf",
      data: "9",
    });
  });

  it("sendEvent sends arbitrary payload", async () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    act(() => result.current.sendEvent({ type: "custom", value: 42 }));

    const { WebSocketTransport } = await import("@realtalk-ai/core");
    const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
    expect(transport.sendEvent).toHaveBeenCalledWith({
      type: "custom",
      value: 42,
    });
  });
});
