import { describe, it, expect, vi } from "vitest";
import type {
  ConversationEvent,
  Message,
  AnnotationItem,
} from "../src/types.js";
import { ConversationClient } from "../src/conversation-client.js";

interface MessageCallbacks {
  onMessage?: (message: Message) => void;
  onAnnotation?: (item: AnnotationItem) => void;
}

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-1",
    role: "agent",
    text: "Hello",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeAnnotation(overrides: Record<string, unknown> = {}) {
  return {
    id: "annotation-1",
    createdAt: "2024-01-01T00:00:00Z",
    annotation: { kind: "handoff_requested" },
    ...overrides,
  };
}

async function setup(callbacks: MessageCallbacks = {}) {
  let emit: (event: ConversationEvent) => void = () => {};
  const client = new ConversationClient({
    baseUrl: "wss://test.example.com",
    sdkInfo: { name: "test", version: "0.0.0", context: "web_chat" },
    createTransport: () =>
      ({
        status: "disconnected",
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn(),
        gracefulDisconnect: vi.fn().mockResolvedValue(undefined),
        sendAudio: vi.fn(),
        sendEvent: vi.fn(),
        onAudio: vi.fn(),
        onEvent: (callback: (event: ConversationEvent) => void) => {
          emit = callback;
        },
        onStatusChange: vi.fn(),
        removeAllListeners: vi.fn(),
      }) as never,
    callbacks,
  });
  await client.start({
    agentId: "agent-1",
    conversationId: "conv-1",
    token: "token",
  });
  const view = {
    get messages() {
      return client.getSnapshot().messages;
    },
    get annotations() {
      return client.getSnapshot().annotations;
    },
    get userState() {
      return client.getSnapshot().userState;
    },
    get thinkingMessageId() {
      return client.getSnapshot().thinkingMessageId;
    },
    handleMessageEvent: (event: ConversationEvent) => emit(event),
    clearMessages: () => client.clearMessages(),
  };
  return { result: { current: view } };
}

function act<T>(run: () => T): T {
  return run();
}

describe("ConversationClient, with the cases of the former messages hook", () => {
  it("starts with empty messages, userState=idle", async () => {
    const { result } = await setup();

    expect(result.current.messages).toEqual([]);
    expect(result.current.userState).toBe("idle");
    expect(result.current.thinkingMessageId).toBeNull();
  });

  it("existing_messages event sets messages as-is", async () => {
    const { result } = await setup();

    const event: ConversationEvent = {
      type: "existing_messages",
      data: [
        makeMessage({
          id: "msg-1",
          createdAt: "2024-01-01T00:00:01Z",
        }),
        makeMessage({
          id: "msg-2",
          createdAt: "2024-01-01T00:00:02Z",
        }),
      ],
      annotations: [],
    };

    act(() => result.current.handleMessageEvent(event));

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].id).toBe("msg-1");
    expect(result.current.messages[1].id).toBe("msg-2");
    expect(result.current.messages[0].role).toBe("agent");
  });

  it("message_created event adds message, calls onMessage", async () => {
    const onMessage = vi.fn();
    const { result } = await setup({ onMessage });

    const event: ConversationEvent = {
      type: "message_created",
      data: makeMessage({ text: "Hi there" }),
    };

    act(() => result.current.handleMessageEvent(event));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe("Hi there");
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("message_updated event merges with existing message", async () => {
    const { result } = await setup();

    act(() =>
      result.current.handleMessageEvent({
        type: "message_created",
        data: makeMessage({ id: "msg-1", text: "Hello" }),
      }),
    );

    act(() =>
      result.current.handleMessageEvent({
        type: "message_updated",
        data: makeMessage({ id: "msg-1", text: "Hello world" }),
      }),
    );

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe("Hello world");
  });

  it("empty agent message on create sets thinkingMessageId", async () => {
    const { result } = await setup();

    act(() =>
      result.current.handleMessageEvent({
        type: "message_created",
        data: makeMessage({
          id: "msg-think",
          role: "agent",
          text: "",
        }),
      }),
    );

    expect(result.current.thinkingMessageId).toBe("msg-think");
    expect(result.current.messages).toHaveLength(0);
  });

  it("non-empty update for thinking message clears thinkingMessageId", async () => {
    const { result } = await setup();

    act(() =>
      result.current.handleMessageEvent({
        type: "message_created",
        data: makeMessage({
          id: "msg-think",
          role: "agent",
          text: "",
        }),
      }),
    );

    expect(result.current.thinkingMessageId).toBe("msg-think");

    act(() =>
      result.current.handleMessageEvent({
        type: "message_updated",
        data: makeMessage({
          id: "msg-think",
          role: "agent",
          text: "Thought complete",
        }),
      }),
    );

    expect(result.current.thinkingMessageId).toBeNull();
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe("Thought complete");
  });

  it("vad event with state speech sets userState to speaking", async () => {
    const { result } = await setup();

    act(() =>
      result.current.handleMessageEvent({
        type: "vad",
        data: { state: "speech" },
      }),
    );

    expect(result.current.userState).toBe("speaking");
  });

  it("vad event with silence sets userState to idle", async () => {
    const { result } = await setup();

    act(() =>
      result.current.handleMessageEvent({
        type: "vad",
        data: { state: "speech" },
      }),
    );

    act(() =>
      result.current.handleMessageEvent({
        type: "vad",
        data: { state: "silence" },
      }),
    );

    expect(result.current.userState).toBe("idle");
  });

  it("existing_messages event replaces the annotations", async () => {
    const { result } = await setup();

    act(() =>
      result.current.handleMessageEvent({
        type: "existing_messages",
        data: [],
        annotations: [makeAnnotation({ id: "annotation-1" })],
      }),
    );

    const joined = makeAnnotation({
      id: "annotation-2",
      annotation: { kind: "human_agent_joined", humanAgentName: "Filip" },
    });

    act(() =>
      result.current.handleMessageEvent({
        type: "existing_messages",
        data: [],
        annotations: [joined],
      }),
    );

    expect(result.current.annotations).toEqual([joined]);
  });

  it("existing_messages event without annotations empties them", async () => {
    const { result } = await setup();

    act(() =>
      result.current.handleMessageEvent({
        type: "existing_messages",
        data: [],
        annotations: [makeAnnotation({ id: "annotation-1" })],
      }),
    );

    act(() =>
      result.current.handleMessageEvent({
        type: "existing_messages",
        data: [makeMessage()],
      } as unknown as ConversationEvent),
    );

    expect(result.current.messages).toEqual([makeMessage()]);
    expect(result.current.annotations).toEqual([]);
  });

  it("clearMessages empties the messages and the annotations", async () => {
    const { result } = await setup();

    act(() =>
      result.current.handleMessageEvent({
        type: "existing_messages",
        data: [makeMessage()],
        annotations: [makeAnnotation()],
      }),
    );

    act(() => result.current.clearMessages());

    expect(result.current.messages).toEqual([]);
    expect(result.current.annotations).toEqual([]);
  });

  it("annotation_created event adds an annotation once per id", async () => {
    const { result } = await setup();

    const requested = makeAnnotation({ id: "annotation-1" });
    const joined = makeAnnotation({
      id: "annotation-2",
      annotation: { kind: "human_agent_joined", humanAgentName: "Filip" },
    });

    act(() =>
      result.current.handleMessageEvent({
        type: "existing_messages",
        data: [],
        annotations: [requested],
      }),
    );

    act(() =>
      result.current.handleMessageEvent({
        type: "annotation_created",
        data: joined,
      }),
    );

    act(() =>
      result.current.handleMessageEvent({
        type: "annotation_created",
        data: joined,
      }),
    );

    expect(result.current.annotations).toEqual([requested, joined]);
  });

  it("annotation_created event keeps the annotations sorted by createdAt", async () => {
    const { result } = await setup();

    const requested = makeAnnotation({
      id: "annotation-1",
      createdAt: "2024-01-01T00:00:01Z",
    });
    const joined = makeAnnotation({
      id: "annotation-2",
      createdAt: "2024-01-01T00:00:02Z",
      annotation: { kind: "human_agent_joined", humanAgentName: "Filip" },
    });

    act(() =>
      result.current.handleMessageEvent({
        type: "existing_messages",
        data: [],
        annotations: [joined],
      }),
    );

    act(() =>
      result.current.handleMessageEvent({
        type: "annotation_created",
        data: requested,
      }),
    );

    expect(result.current.annotations).toEqual([requested, joined]);
  });

  it("annotation_created event calls onAnnotation with the annotation", async () => {
    const onAnnotation = vi.fn();
    const { result } = await setup({ onAnnotation });

    const joined = makeAnnotation({
      id: "annotation-2",
      annotation: { kind: "human_agent_joined", humanAgentName: "Filip" },
    });

    act(() =>
      result.current.handleMessageEvent({
        type: "annotation_created",
        data: joined,
      }),
    );

    expect(onAnnotation).toHaveBeenCalledTimes(1);
    expect(onAnnotation).toHaveBeenCalledWith(joined);
  });

  it("existing_messages event does not call onAnnotation", async () => {
    const onAnnotation = vi.fn();
    const { result } = await setup({ onAnnotation });

    act(() =>
      result.current.handleMessageEvent({
        type: "existing_messages",
        data: [],
        annotations: [
          makeAnnotation({ id: "annotation-1" }),
          makeAnnotation({
            id: "annotation-2",
            annotation: { kind: "human_agent_joined", humanAgentName: "Filip" },
          }),
        ],
      }),
    );

    expect(result.current.annotations).toHaveLength(2);
    expect(onAnnotation).not.toHaveBeenCalled();
  });
});
