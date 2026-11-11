import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { MessageNotShownError } from "@realtalk-ai/core";
import type { ConversationEvent, ConversationMode } from "@realtalk-ai/core";
import { RealTalkProvider } from "../src/provider.js";
import { useConversation } from "../src/useConversation.js";

const TEXT_ONLY = { userAudio: false, agentAudio: false };
const TEXT_WITH_AGENT_AUDIO = { userAudio: false, agentAudio: true };
const USER_AUDIO_WITH_TEXT_REPLIES = { userAudio: true, agentAudio: false };
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
    expect(result.current.annotations).toEqual([]);
    expect(result.current.timeline).toEqual([]);
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

  it("endConversation sends hangup, disconnects and keeps the messages", async () => {
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
      }),
    );

    await act(async () => {
      await result.current.endConversation();
    });

    expect(transport.sendEvent).toHaveBeenCalledWith({
      type: "hangup",
      data: {},
    });
    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.status).toBe("finished");
    expect(result.current.messages).toHaveLength(1);
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
        mode: AUDIO_BOTH_WAYS,
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
      }),
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
      }),
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
      }),
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
      }),
    );
    expect(onMessage).toHaveBeenCalled();
  });

  it("onAnnotation callback is invoked for annotation events", async () => {
    const onAnnotation = vi.fn();

    const { result } = renderHook(() => useConversation({ onAnnotation }), {
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

    const joined = {
      id: "annotation-1",
      createdAt: "2024-01-01T00:00:00Z",
      annotation: { kind: "human_agent_joined", humanAgentName: "Filip" },
    };

    act(() => onEventCb({ type: "annotation_created", data: joined }));
    expect(onAnnotation).toHaveBeenCalledTimes(1);
    expect(onAnnotation).toHaveBeenCalledWith(joined);
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
    expect(result.current.status).toBe("finished");
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

  it("startMuted applies volume 0 to a new conversation's player", async () => {
    const { result } = renderHook(() => useConversation({ startMuted: true }), {
      wrapper,
    });

    expect(result.current.isAudioMuted).toBe(true);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
      });
    });

    expect(mockPlayer.setVolume).toHaveBeenCalledWith(0);
  });

  it("enableMic starts a recorder and disableMic stops it", async () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
        mode: TEXT_ONLY,
      });
    });

    expect(result.current.isMicEnabled).toBe(false);

    await act(async () => {
      await result.current.enableMic();
    });

    expect(result.current.isMicEnabled).toBe(true);
    expect(mockRecorder.start).toHaveBeenCalledTimes(1);

    act(() => result.current.disableMic());

    expect(result.current.isMicEnabled).toBe(false);
    expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
  });

  it("enableMic failure resets state and rethrows", async () => {
    mockRecorder.start.mockRejectedValueOnce(new Error("denied"));
    const { result } = renderHook(() => useConversation(), { wrapper });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
        mode: TEXT_ONLY,
      });
    });

    await expect(result.current.enableMic()).rejects.toThrow("denied");
    expect(result.current.isMicEnabled).toBe(false);

    await act(async () => {
      await result.current.enableMic();
    });
    expect(result.current.isMicEnabled).toBe(true);
  });

  it("voice mode enables the mic and endConversation releases it", async () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-1",
        mode: AUDIO_BOTH_WAYS,
      });
    });

    expect(result.current.isMicEnabled).toBe(true);

    await act(async () => {
      await result.current.endConversation();
    });

    expect(result.current.isMicEnabled).toBe(false);
  });

  it("clearMessages empties the messages array", async () => {
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
      }),
    );

    expect(result.current.messages).toHaveLength(1);

    act(() => result.current.clearMessages());

    expect(result.current.messages).toHaveLength(0);
  });

  it("clearMessages empties the annotations", async () => {
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
        type: "annotation_created",
        data: {
          id: "annotation-1",
          createdAt: "2024-01-01T00:00:00Z",
          annotation: { kind: "handoff_requested" },
        },
      }),
    );

    expect(result.current.annotations).toHaveLength(1);

    act(() => result.current.clearMessages());

    expect(result.current.annotations).toHaveLength(0);
  });

  it("endConversation keeps the annotations and a new startConversation empties them", async () => {
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
        type: "existing_messages",
        data: [],
        annotations: [
          {
            id: "annotation-1",
            createdAt: "2024-01-01T00:00:00Z",
            annotation: { kind: "handoff_requested" },
          },
        ],
      }),
    );

    await act(async () => {
      await result.current.endConversation();
    });

    expect(result.current.annotations).toHaveLength(1);

    await act(async () => {
      await result.current.startConversation({
        agentId: "agent-1",
        conversationId: "conv-2",
      });
    });

    expect(result.current.annotations).toHaveLength(0);
  });

  it("a startConversation rejected while active keeps the annotations", async () => {
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
        type: "annotation_created",
        data: {
          id: "annotation-1",
          createdAt: "2024-01-01T00:00:00Z",
          annotation: { kind: "handoff_requested" },
        },
      }),
    );

    await act(async () => {
      await expect(
        result.current.startConversation({
          agentId: "agent-1",
          conversationId: "conv-1",
        }),
      ).rejects.toThrow("Conversation already active");
    });

    expect(result.current.annotations).toHaveLength(1);
  });

  it("timeline puts each annotation before the first message created after it", async () => {
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

    const question = {
      id: "msg-1",
      role: "user",
      text: "Can I talk to a person?",
      createdAt: "2024-01-01T00:00:00Z",
    };
    const answer = {
      id: "msg-2",
      role: "agent",
      text: "A human agent will be with you shortly.",
      createdAt: "2024-01-01T00:00:02Z",
    };
    const requested = {
      id: "annotation-1",
      createdAt: "2024-01-01T00:00:01Z",
      annotation: { kind: "handoff_requested" },
    };
    const joined = {
      id: "annotation-2",
      createdAt: "2024-01-01T00:00:03Z",
      annotation: { kind: "human_agent_joined", humanAgentName: "Filip" },
    };

    act(() =>
      onEventCb({
        type: "existing_messages",
        data: [question, answer],
        annotations: [requested],
      }),
    );
    act(() => onEventCb({ type: "annotation_created", data: joined }));

    expect(result.current.timeline).toEqual([
      { type: "message", message: question },
      { type: "annotation", annotation: requested },
      { type: "message", message: answer },
      { type: "annotation", annotation: joined },
    ]);
  });

  describe("setMode", () => {
    async function startedConversation() {
      const rendered = renderHook(() => useConversation(), { wrapper });
      await act(async () => {
        await rendered.result.current.startConversation({
          agentId: "agent-1",
          conversationId: "conv-1",
          mode: TEXT_ONLY,
        });
      });
      const { WebSocketTransport } = await import("@realtalk-ai/core");
      const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
      const emit = transport.onEvent.mock.calls[0][0];
      return { ...rendered, transport, emit };
    }

    it.each([AUDIO_BOTH_WAYS, USER_AUDIO_WITH_TEXT_REPLIES])(
      "a mode with user audio enables the microphone and asks the server for it",
      async (mode) => {
        const { result, transport, emit } = await startedConversation();

        await act(async () => {
          await result.current.setMode(mode);
        });
        act(() => emit({ type: "conversation_mode", data: onTheWire(mode) }));

        expect(transport.sendEvent).toHaveBeenCalledWith({
          type: "set_conversation_mode",
          data: onTheWire(mode),
        });
        expect(result.current.isMicEnabled).toBe(true);
        expect(result.current.mode).toEqual(mode);
      },
    );

    it("turning user audio off releases the microphone", async () => {
      const { result, transport, emit } = await startedConversation();
      await act(async () => {
        await result.current.setMode(AUDIO_BOTH_WAYS);
      });
      act(() =>
        emit({ type: "conversation_mode", data: onTheWire(AUDIO_BOTH_WAYS) }),
      );

      await act(async () => {
        await result.current.setMode(TEXT_WITH_AGENT_AUDIO);
      });

      expect(transport.sendEvent).toHaveBeenLastCalledWith({
        type: "set_conversation_mode",
        data: onTheWire(TEXT_WITH_AGENT_AUDIO),
      });
      expect(result.current.isMicEnabled).toBe(false);
    });

    it("refused user audio releases the microphone again", async () => {
      const { result, emit } = await startedConversation();

      await act(async () => {
        await result.current.setMode(AUDIO_BOTH_WAYS);
      });
      act(() =>
        emit({ type: "conversation_mode", data: onTheWire(TEXT_ONLY) }),
      );

      expect(result.current.isMicEnabled).toBe(false);
      expect(result.current.mode).toEqual(TEXT_ONLY);
      expect(result.current.error?.fatal).toBe(false);
    });

    it("a refused change keeps the microphone while user audio stays on", async () => {
      const { result, emit } = await startedConversation();
      await act(async () => {
        await result.current.setMode(USER_AUDIO_WITH_TEXT_REPLIES);
      });
      act(() =>
        emit({
          type: "conversation_mode",
          data: onTheWire(USER_AUDIO_WITH_TEXT_REPLIES),
        }),
      );

      await act(async () => {
        await result.current.setMode(AUDIO_BOTH_WAYS);
      });
      act(() =>
        emit({
          type: "conversation_mode",
          data: onTheWire(USER_AUDIO_WITH_TEXT_REPLIES),
        }),
      );

      expect(result.current.isMicEnabled).toBe(true);
      expect(result.current.mode).toEqual(USER_AUDIO_WITH_TEXT_REPLIES);
    });

    it("enableMic turns a conversation without user audio into audio both ways", async () => {
      const { result, transport } = await startedConversation();

      await act(async () => {
        await result.current.enableMic();
      });

      expect(transport.sendEvent).toHaveBeenLastCalledWith({
        type: "set_conversation_mode",
        data: onTheWire(AUDIO_BOTH_WAYS),
      });
    });

    it("enableMic keeps the mode when user audio is already on", async () => {
      const { result, transport, emit } = await startedConversation();
      await act(async () => {
        await result.current.setMode(USER_AUDIO_WITH_TEXT_REPLIES);
      });
      act(() =>
        emit({
          type: "conversation_mode",
          data: onTheWire(USER_AUDIO_WITH_TEXT_REPLIES),
        }),
      );
      transport.sendEvent.mockClear();

      await act(async () => {
        await result.current.enableMic();
      });

      expect(transport.sendEvent).not.toHaveBeenCalled();
    });
  });

  describe("sendMessageAndWait", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function messageEvent(
      type: "message_created" | "message_updated",
      role: "user" | "agent",
      id: string,
    ): ConversationEvent {
      return {
        type,
        data: {
          id,
          role,
          text: "Hello",
          createdAt: "2024-01-01T00:00:00Z",
        },
      };
    }

    async function startedConversation() {
      const rendered = renderHook(() => useConversation(), { wrapper });
      await act(async () => {
        await rendered.result.current.startConversation({
          agentId: "agent-1",
          conversationId: "conv-1",
        });
      });
      const { WebSocketTransport } = await import("@realtalk-ai/core");
      const transport = vi.mocked(WebSocketTransport).mock.results[0].value;
      const emit = transport.onEvent.mock.calls[0][0] as (
        event: ConversationEvent,
      ) => void;

      const send = () => {
        let sent!: Promise<void>;
        const outcome: { settled?: "resolved" | "rejected" } = {};
        act(() => {
          sent = rendered.result.current.sendMessageAndWait("Hello");
        });
        sent.then(
          () => {
            outcome.settled = "resolved";
          },
          () => {
            outcome.settled = "rejected";
          },
        );
        return { sent, outcome };
      };

      const messagesSent = () =>
        transport.sendEvent.mock.calls.filter(
          ([payload]: [{ type?: string }]) => payload.type === "message",
        ).length;

      return { ...rendered, transport, emit, send, messagesSent };
    }

    it("resolves on the first message_created with role user and stops waiting", async () => {
      const { result, emit, send } = await startedConversation();
      const { sent } = send();
      expect(result.current.isSendPending).toBe(true);

      act(() => emit(messageEvent("message_created", "user", "msg-1")));

      await expect(sent).resolves.toBeUndefined();
      expect(result.current.isSendPending).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      act(() => emit(messageEvent("message_created", "user", "msg-2")));
      expect(result.current.isSendPending).toBe(false);
    });

    it("keeps waiting on updates, agent messages and user messages from before the send", async () => {
      const { result, emit, send } = await startedConversation();
      act(() => emit(messageEvent("message_created", "user", "msg-earlier")));
      const { outcome } = send();

      act(() => {
        emit(messageEvent("message_updated", "user", "msg-earlier"));
        emit(messageEvent("message_created", "agent", "msg-agent"));
      });
      await act(async () => {});

      expect(outcome.settled).toBeUndefined();
      expect(result.current.isSendPending).toBe(true);
    });

    it("rejects when the server stops accepting messages, not when it accepts them", async () => {
      const { result, emit, send } = await startedConversation();
      const { sent, outcome } = send();

      act(() =>
        emit({ type: "web_messages_accepted", data: { accepted: true } }),
      );
      await act(async () => {});
      expect(outcome.settled).toBeUndefined();

      act(() =>
        emit({ type: "web_messages_accepted", data: { accepted: false } }),
      );
      await expect(sent).rejects.toBeInstanceOf(MessageNotShownError);
      expect(result.current.isSendPending).toBe(false);
    });

    it.each([
      ["the connection drops", { type: "close", code: 1006, reason: "" }],
      [
        "the server pauses the conversation",
        { type: "close", code: 4005, reason: "Idle timeout" },
      ],
      ["the conversation finishes", { type: "conversation_finished" }],
    ] as [string, ConversationEvent][])("rejects when %s", async (_, event) => {
      const { result, emit, send } = await startedConversation();
      const { sent } = send();

      act(() => emit(event));

      await expect(sent).rejects.toBeInstanceOf(MessageNotShownError);
      expect(result.current.isSendPending).toBe(false);
    });

    it("rejects when the conversation is ended", async () => {
      const { result, send } = await startedConversation();
      const { sent } = send();

      await act(async () => {
        await result.current.endConversation();
      });

      await expect(sent).rejects.toBeInstanceOf(MessageNotShownError);
      expect(result.current.isSendPending).toBe(false);
    });

    it("rejects when the hook unmounts", async () => {
      const { unmount, send } = await startedConversation();
      const { sent } = send();

      unmount();

      await expect(sent).rejects.toBeInstanceOf(MessageNotShownError);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("rejects after 30 seconds without an outcome", async () => {
      const { result, send } = await startedConversation();
      const { sent, outcome } = send();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(29_999);
      });
      expect(outcome.settled).toBeUndefined();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      await expect(sent).rejects.toBeInstanceOf(MessageNotShownError);
      expect(result.current.isSendPending).toBe(false);
    });

    it("sends and waits again after a message showed up and after a timeout", async () => {
      const { result, emit, send, messagesSent } = await startedConversation();
      const first = send();
      act(() => emit(messageEvent("message_created", "user", "msg-1")));
      await expect(first.sent).resolves.toBeUndefined();

      const second = send();
      expect(messagesSent()).toBe(2);
      expect(result.current.isSendPending).toBe(true);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      await expect(second.sent).rejects.toBeInstanceOf(MessageNotShownError);

      send();
      expect(messagesSent()).toBe(3);
      expect(result.current.isSendPending).toBe(true);
    });

    it("rejects without sending while an earlier wait is pending", async () => {
      const { result, send, messagesSent } = await startedConversation();
      send();
      let second!: Promise<void>;

      act(() => {
        second = result.current.sendMessageAndWait("Hello again");
      });

      await expect(second).rejects.toBeInstanceOf(MessageNotShownError);
      expect(messagesSent()).toBe(1);
      expect(result.current.isSendPending).toBe(true);
    });

    it("plain sendMessage sends at once while a wait is pending and does not set isSendPending", async () => {
      const { result, send, messagesSent } = await startedConversation();

      act(() => result.current.sendMessage("Hi"));
      expect(messagesSent()).toBe(1);
      expect(result.current.isSendPending).toBe(false);

      const { outcome } = send();
      act(() => result.current.sendMessage("Hi again"));
      await act(async () => {});

      expect(messagesSent()).toBe(3);
      expect(outcome.settled).toBeUndefined();
      expect(result.current.isSendPending).toBe(true);
    });

    it("rejects without sending while reconnecting and stays unlocked", async () => {
      const { result, emit, send, messagesSent } = await startedConversation();
      act(() => emit({ type: "close", code: 1006, reason: "" }));
      expect(result.current.connectionStatus).toBe("reconnecting");

      const { sent } = send();

      await expect(sent).rejects.toBeInstanceOf(MessageNotShownError);
      expect(messagesSent()).toBe(0);
      expect(result.current.isSendPending).toBe(false);
    });

    it("rejects without sending before the conversation starts", async () => {
      const { result } = renderHook(() => useConversation(), { wrapper });
      let sent!: Promise<void>;

      act(() => {
        sent = result.current.sendMessageAndWait("Hello");
      });

      await expect(sent).rejects.toBeInstanceOf(MessageNotShownError);
      expect(result.current.isSendPending).toBe(false);
    });
  });
});
