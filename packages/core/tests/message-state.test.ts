import { describe, it, expect } from "vitest";
import type { AnnotationItem, Message } from "../src/types.js";
import {
  applyMessageEvent,
  EMPTY_MESSAGE_STATE,
} from "../src/message-state.js";

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "m1",
    role: "agent",
    text: "Hej",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function annotation(id: string, createdAt: string): AnnotationItem {
  return {
    id,
    createdAt,
    annotation: { kind: "human_agent_joined", humanAgentName: null },
  } as AnnotationItem;
}

describe("applyMessageEvent", () => {
  it("replaces messages and annotations with the existing ones", () => {
    const existing = [message({ id: "a" }), message({ id: "b" })];
    const annotations = [annotation("x", "2026-01-01T00:00:00Z")];

    const { state } = applyMessageEvent(
      { ...EMPTY_MESSAGE_STATE, messages: [message({ id: "old" })] },
      { type: "existing_messages", data: existing, annotations },
    );

    expect(state.messages).toEqual(existing);
    expect(state.annotations).toEqual(annotations);
  });

  it("marks the agent as thinking for a new empty agent message, without adding it", () => {
    const change = applyMessageEvent(EMPTY_MESSAGE_STATE, {
      type: "message_created",
      data: message({ text: "" }),
    });

    expect(change.state.thinkingMessageId).toBe("m1");
    expect(change.state.messages).toEqual([]);
    expect(change.message).toBeUndefined();
  });

  it("adds the message and stops thinking once it has text", () => {
    const thinking = { ...EMPTY_MESSAGE_STATE, thinkingMessageId: "m1" };

    const change = applyMessageEvent(thinking, {
      type: "message_updated",
      data: message({ text: "Hej" }),
    });

    expect(change.state.thinkingMessageId).toBeNull();
    expect(change.state.messages).toEqual([message({ text: "Hej" })]);
    expect(change.message).toEqual(message({ text: "Hej" }));
  });

  it("merges an update into the message with the same id", () => {
    const state = {
      ...EMPTY_MESSAGE_STATE,
      messages: [message({ text: "Hej", hasBeenAnswered: false })],
    };

    const { state: next } = applyMessageEvent(state, {
      type: "message_updated",
      data: message({ text: "Hej igen" }),
    });

    expect(next.messages).toEqual([
      message({ text: "Hej igen", hasBeenAnswered: false }),
    ]);
  });

  it("keeps annotations in time order and reports the new one", () => {
    const later = annotation("later", "2026-01-01T00:00:10Z");
    const earlier = annotation("earlier", "2026-01-01T00:00:05Z");

    const change = applyMessageEvent(
      { ...EMPTY_MESSAGE_STATE, annotations: [later] },
      { type: "annotation_created", data: earlier },
    );

    expect(change.state.annotations.map((item) => item.id)).toEqual([
      "earlier",
      "later",
    ]);
    expect(change.annotation).toEqual(earlier);
  });

  it("tracks whether the user is speaking", () => {
    const speaking = applyMessageEvent(EMPTY_MESSAGE_STATE, {
      type: "vad",
      data: { state: "speech" },
    });
    const silent = applyMessageEvent(speaking.state, {
      type: "vad",
      data: { state: "silence" },
    });

    expect(speaking.state.userState).toBe("speaking");
    expect(silent.state.userState).toBe("idle");
  });
});
