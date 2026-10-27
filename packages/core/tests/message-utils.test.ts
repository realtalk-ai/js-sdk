import { describe, it, expect } from "vitest";
import type { AnnotationItem, BackendMessage, Message } from "../src/types.js";
import {
  normalizeMessage,
  sortChronological,
  convertEventForSDK,
  buildTimeline,
} from "../src/events.js";

describe("normalizeMessage", () => {
  const base: BackendMessage = {
    id: "msg-1",
    sender: "Agent",
    text: "Hello",
    timestamp: "2025-01-01T00:00:00Z",
  };

  it("maps sender to role", () => {
    expect(normalizeMessage({ ...base, sender: "Agent" }).role).toBe("agent");
    expect(normalizeMessage({ ...base, sender: "User" }).role).toBe("user");
    expect(normalizeMessage({ ...base, sender: "anything" }).role).toBe("user");
  });

  it("maps timestamp to createdAt", () => {
    expect(normalizeMessage(base).createdAt).toBe("2025-01-01T00:00:00Z");
  });

  it("maps snake_case boolean fields to camelCase", () => {
    const msg = normalizeMessage({
      ...base,
      has_been_answered: true,
      should_be_answered: false,
    });
    expect(msg.hasBeenAnswered).toBe(true);
    expect(msg.shouldBeAnswered).toBe(false);
  });

  it("normalizes metadata with rag_documents_used", () => {
    const msg = normalizeMessage({
      ...base,
      metadata: {
        type: "answer",
        rag_documents_used: ["doc1", "doc2"],
      },
    });
    expect(msg.metadata?.ragDocumentsUsed).toEqual(["doc1", "doc2"]);
    expect(msg.metadata?.type).toBe("answer");
  });

  it("normalizes tool_calls in metadata", () => {
    const msg = normalizeMessage({
      ...base,
      metadata: {
        tool_calls: [
          { id: "tc-1", function: { name: "lookup", arguments: "{}" } },
        ],
      },
    });
    expect(msg.metadata?.toolCalls).toEqual([
      { id: "tc-1", function: { name: "lookup", arguments: "{}" } },
    ]);
  });

  it("normalizes tool_results in metadata", () => {
    const msg = normalizeMessage({
      ...base,
      metadata: {
        tool_results: [
          {
            tool_call_id: "tc-1",
            type: "function",
            role: "tool",
            name: "lookup",
            content: "result",
          },
        ],
      },
    });
    expect(msg.metadata?.toolResults).toEqual([
      {
        toolCallId: "tc-1",
        type: "function",
        role: "tool",
        name: "lookup",
        content: "result",
      },
    ]);
  });

  it("normalizes user latencies", () => {
    const msg = normalizeMessage({
      ...base,
      metadata: { latencies: { transcription_ms: 150 } },
    });
    expect(msg.metadata?.latencies).toEqual({ transcriptionMs: 150 });
  });

  it("normalizes assistant latencies", () => {
    const msg = normalizeMessage({
      ...base,
      metadata: {
        latencies: {
          first_sentence_llm_ms: 200,
          first_sentence_tts_ms: 100,
          user_silence_to_speech_ms: 500,
        },
      },
    });
    expect(msg.metadata?.latencies).toEqual({
      firstSentenceLlmMs: 200,
      firstSentenceTtsMs: 100,
      userSilenceToSpeechMs: 500,
    });
  });

  it("returns undefined metadata when none provided", () => {
    expect(normalizeMessage(base).metadata).toBeUndefined();
  });
});

describe("sortChronological", () => {
  it("sorts messages by createdAt ascending", () => {
    const messages = [
      {
        id: "3",
        role: "user" as const,
        text: "c",
        createdAt: "2025-01-03T00:00:00Z",
      },
      {
        id: "1",
        role: "agent" as const,
        text: "a",
        createdAt: "2025-01-01T00:00:00Z",
      },
      {
        id: "2",
        role: "user" as const,
        text: "b",
        createdAt: "2025-01-02T00:00:00Z",
      },
    ];

    const sorted = sortChronological(messages);
    expect(sorted.map((m) => m.id)).toEqual(["1", "2", "3"]);
  });

  it("does not mutate the original array", () => {
    const messages = [
      {
        id: "2",
        role: "user" as const,
        text: "b",
        createdAt: "2025-01-02T00:00:00Z",
      },
      {
        id: "1",
        role: "agent" as const,
        text: "a",
        createdAt: "2025-01-01T00:00:00Z",
      },
    ];

    sortChronological(messages);
    expect(messages[0].id).toBe("2");
  });

  it("handles empty array", () => {
    expect(sortChronological([])).toEqual([]);
  });
});

describe("convertEventForSDK", () => {
  const backendMsg: BackendMessage = {
    id: "msg-1",
    sender: "Agent",
    role: "assistant",
    text: "Hello",
    timestamp: "2025-01-01T00:00:00Z",
  };

  it("normalizes existing_messages and sorts by createdAt", () => {
    const event = convertEventForSDK({
      type: "existing_messages",
      data: [
        { ...backendMsg, id: "msg-2", timestamp: "2025-01-01T00:00:02Z" },
        { ...backendMsg, id: "msg-1", timestamp: "2025-01-01T00:00:01Z" },
      ],
    });

    expect(event.type).toBe("existing_messages");
    if (event.type !== "existing_messages") throw new Error("wrong type");
    expect(event.data).toHaveLength(2);
    expect(event.data[0].id).toBe("msg-1");
    expect(event.data[1].id).toBe("msg-2");
    expect(event.data[0].role).toBe("agent");
    expect(event.data[0].createdAt).toBe("2025-01-01T00:00:01Z");
  });

  it("normalizes message_created", () => {
    const event = convertEventForSDK({
      type: "message_created",
      data: backendMsg,
    });

    expect(event.type).toBe("message_created");
    if (event.type !== "message_created") throw new Error("wrong type");
    expect(event.data.id).toBe("msg-1");
    expect(event.data.role).toBe("agent");
    expect(event.data.createdAt).toBe("2025-01-01T00:00:00Z");
  });

  it("normalizes message_updated", () => {
    const event = convertEventForSDK({
      type: "message_updated",
      data: { ...backendMsg, text: "Updated" },
    });

    expect(event.type).toBe("message_updated");
    if (event.type !== "message_updated") throw new Error("wrong type");
    expect(event.data.text).toBe("Updated");
    expect(event.data.role).toBe("agent");
  });

  const handoffRequested: BackendMessage = {
    ...backendMsg,
    id: "annotation-1",
    sender: "User",
    role: "annotation",
    text: "",
    timestamp: "2025-01-01T00:00:01Z",
    metadata: { kind: "handoff_requested" },
  };

  const humanAgentJoined: BackendMessage = {
    ...handoffRequested,
    id: "annotation-2",
    timestamp: "2025-01-01T00:00:02Z",
    metadata: { kind: "human_agent_joined", human_agent_name: "Filip" },
  };

  const unknownKind: BackendMessage = {
    ...handoffRequested,
    id: "annotation-3",
    timestamp: "2025-01-01T00:00:03Z",
    metadata: { kind: "not_a_real_kind" },
  };

  it("moves annotation rows out of existing_messages and sorts them by createdAt", () => {
    const event = convertEventForSDK({
      type: "existing_messages",
      data: [humanAgentJoined, backendMsg, handoffRequested],
    });

    if (event.type !== "existing_messages") throw new Error("wrong type");
    expect(event.data.map((msg) => msg.id)).toEqual(["msg-1"]);
    expect(event.annotations).toEqual([
      {
        id: "annotation-1",
        createdAt: "2025-01-01T00:00:01Z",
        annotation: { kind: "handoff_requested" },
      },
      {
        id: "annotation-2",
        createdAt: "2025-01-01T00:00:02Z",
        annotation: { kind: "human_agent_joined", humanAgentName: "Filip" },
      },
    ]);
  });

  it("drops annotation rows of an unknown kind from existing_messages", () => {
    const event = convertEventForSDK({
      type: "existing_messages",
      data: [backendMsg, handoffRequested, unknownKind],
    });

    if (event.type !== "existing_messages") throw new Error("wrong type");
    expect(event.data.map((msg) => msg.id)).toEqual(["msg-1"]);
    expect(event.annotations.map((item) => item.id)).toEqual(["annotation-1"]);
  });

  it("keeps a user row with a metadata kind in existing_messages", () => {
    const event = convertEventForSDK({
      type: "existing_messages",
      data: [
        {
          ...backendMsg,
          sender: "User",
          role: "user",
          metadata: { kind: "handoff_requested" },
        },
      ],
    });

    if (event.type !== "existing_messages") throw new Error("wrong type");
    expect(event.data.map((msg) => msg.id)).toEqual(["msg-1"]);
    expect(event.annotations).toEqual([]);
  });

  it("normalizes annotation_created", () => {
    const event = convertEventForSDK({
      type: "annotation_created",
      data: humanAgentJoined,
    });

    expect(event).toEqual({
      type: "annotation_created",
      data: {
        id: "annotation-2",
        createdAt: "2025-01-01T00:00:02Z",
        annotation: { kind: "human_agent_joined", humanAgentName: "Filip" },
      },
    });
  });

  it("gives a human agent without a first name a null humanAgentName", () => {
    const event = convertEventForSDK({
      type: "annotation_created",
      data: {
        ...humanAgentJoined,
        metadata: { kind: "human_agent_joined", human_agent_name: null },
      },
    });

    expect(event).toEqual({
      type: "annotation_created",
      data: {
        id: "annotation-2",
        createdAt: "2025-01-01T00:00:02Z",
        annotation: { kind: "human_agent_joined", humanAgentName: null },
      },
    });
  });

  it("drops annotation_created of an unknown kind", () => {
    const event = convertEventForSDK({
      type: "annotation_created",
      data: unknownKind,
    });

    expect(event).toBeNull();
  });

  it("passes through non-message events unchanged", () => {
    const vadEvent = { type: "vad", data: { state: "speech" } };
    expect(convertEventForSDK(vadEvent)).toEqual(vadEvent);

    const clearEvent = { type: "clear" };
    expect(convertEventForSDK(clearEvent)).toEqual(clearEvent);

    const finishedEvent = { type: "conversation_finished" };
    expect(convertEventForSDK(finishedEvent)).toEqual(finishedEvent);
  });
});

describe("buildTimeline", () => {
  it("puts each annotation before the first message created after it", () => {
    const question: Message = {
      id: "msg-1",
      role: "user",
      text: "Can I talk to a person?",
      createdAt: "2024-01-01T00:00:00Z",
    };
    const answer: Message = {
      id: "msg-2",
      role: "agent",
      text: "A human agent will be with you shortly.",
      createdAt: "2024-01-01T00:00:02Z",
    };
    const requested: AnnotationItem = {
      id: "annotation-1",
      createdAt: "2024-01-01T00:00:01Z",
      annotation: { kind: "handoff_requested" },
    };
    const joined: AnnotationItem = {
      id: "annotation-2",
      createdAt: "2024-01-01T00:00:03Z",
      annotation: { kind: "human_agent_joined", humanAgentName: "Filip" },
    };

    expect(buildTimeline([question, answer], [requested, joined])).toEqual([
      { type: "message", message: question },
      { type: "annotation", annotation: requested },
      { type: "message", message: answer },
      { type: "annotation", annotation: joined },
    ]);
  });

  it("places annotations passed out of time order by their time", () => {
    const question: Message = {
      id: "msg-1",
      role: "user",
      text: "Can I talk to a person?",
      createdAt: "2024-01-01T00:00:00Z",
    };
    const answer: Message = {
      id: "msg-2",
      role: "agent",
      text: "A human agent will be with you shortly.",
      createdAt: "2024-01-01T00:00:02Z",
    };
    const requested: AnnotationItem = {
      id: "annotation-1",
      createdAt: "2024-01-01T00:00:01Z",
      annotation: { kind: "handoff_requested" },
    };
    const joined: AnnotationItem = {
      id: "annotation-2",
      createdAt: "2024-01-01T00:00:03Z",
      annotation: { kind: "human_agent_joined", humanAgentName: "Filip" },
    };
    const annotations = [joined, requested];

    expect(buildTimeline([question, answer], annotations)).toEqual([
      { type: "message", message: question },
      { type: "annotation", annotation: requested },
      { type: "message", message: answer },
      { type: "annotation", annotation: joined },
    ]);
    expect(annotations).toEqual([joined, requested]);
  });

  it("keeps the messages in the order they are passed in", () => {
    const question: Message = {
      id: "msg-2",
      role: "user",
      text: "Are you there?",
      createdAt: "2024-01-01T00:00:01Z",
    };
    const reply: Message = {
      id: "msg-1",
      role: "agent",
      text: "Hello!",
      createdAt: "2024-01-01T00:00:00Z",
    };

    expect(buildTimeline([question, reply], [])).toEqual([
      { type: "message", message: question },
      { type: "message", message: reply },
    ]);
  });

  it("puts a message created at an annotation's time before the annotation", () => {
    const joinedAt = "2024-01-01T00:00:01Z";
    const question: Message = {
      id: "msg-1",
      role: "user",
      text: "Is anyone there?",
      createdAt: joinedAt,
    };
    const greeting: Message = {
      id: "msg-2",
      role: "agent",
      text: "Hi, this is Filip.",
      createdAt: "2024-01-01T00:00:02Z",
    };
    const joined: AnnotationItem = {
      id: "annotation-1",
      createdAt: joinedAt,
      annotation: { kind: "human_agent_joined", humanAgentName: "Filip" },
    };

    expect(buildTimeline([question, greeting], [joined])).toEqual([
      { type: "message", message: question },
      { type: "annotation", annotation: joined },
      { type: "message", message: greeting },
    ]);
  });

  it("puts an annotation whose time cannot be parsed after the last message", () => {
    const question: Message = {
      id: "msg-1",
      role: "user",
      text: "Can I talk to a person?",
      createdAt: "2024-01-01T00:00:00Z",
    };
    const answer: Message = {
      id: "msg-2",
      role: "agent",
      text: "A human agent will be with you shortly.",
      createdAt: "2024-01-01T00:00:01Z",
    };
    const joined: AnnotationItem = {
      id: "annotation-1",
      createdAt: "not a time",
      annotation: { kind: "human_agent_joined", humanAgentName: "Filip" },
    };

    expect(buildTimeline([question, answer], [joined])).toEqual([
      { type: "message", message: question },
      { type: "message", message: answer },
      { type: "annotation", annotation: joined },
    ]);
  });
});
