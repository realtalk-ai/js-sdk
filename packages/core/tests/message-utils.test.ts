import { describe, it, expect } from "vitest";
import type { BackendMessage } from "../src/types.js";
import {
  normalizeMessage,
  sortChronological,
  convertEventForSDK,
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

  it("passes through non-message events unchanged", () => {
    const vadEvent = { type: "vad", data: { state: "speech" } };
    expect(convertEventForSDK(vadEvent)).toEqual(vadEvent);

    const clearEvent = { type: "clear" };
    expect(convertEventForSDK(clearEvent)).toEqual(clearEvent);

    const finishedEvent = { type: "conversation_finished" };
    expect(convertEventForSDK(finishedEvent)).toEqual(finishedEvent);
  });
});
