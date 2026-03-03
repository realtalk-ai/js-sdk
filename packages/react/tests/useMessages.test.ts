import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { UseMessagesCallbacks } from "../src/hooks/useMessages.js";
import { useMessages } from "../src/hooks/useMessages.js";
import type { ConversationEvent } from "@realtalk-ai/core";

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-1",
    role: "agent",
    text: "Hello",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function setup(callbacks: UseMessagesCallbacks = {}) {
  const callbacksRef = { current: callbacks };
  return renderHook(() => useMessages(callbacksRef));
}

describe("useMessages", () => {
  it("starts with empty messages, userState=idle", () => {
    const { result } = setup();

    expect(result.current.messages).toEqual([]);
    expect(result.current.userState).toBe("idle");
    expect(result.current.thinkingMessageId).toBeNull();
  });

  it("existing_messages event sets messages as-is", () => {
    const { result } = setup();

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
    };

    act(() => result.current.handleMessageEvent(event));

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].id).toBe("msg-1");
    expect(result.current.messages[1].id).toBe("msg-2");
    expect(result.current.messages[0].role).toBe("agent");
  });

  it("message_created event adds message, calls onMessage", () => {
    const onMessage = vi.fn();
    const { result } = setup({ onMessage });

    const event: ConversationEvent = {
      type: "message_created",
      data: makeMessage({ text: "Hi there" }),
    };

    act(() => result.current.handleMessageEvent(event));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe("Hi there");
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("message_updated event merges with existing message", () => {
    const { result } = setup();

    act(() =>
      result.current.handleMessageEvent({
        type: "message_created",
        data: makeMessage({ id: "msg-1", text: "Hello" }),
      })
    );

    act(() =>
      result.current.handleMessageEvent({
        type: "message_updated",
        data: makeMessage({ id: "msg-1", text: "Hello world" }),
      })
    );

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe("Hello world");
  });

  it("empty agent message on create sets thinkingMessageId", () => {
    const { result } = setup();

    act(() =>
      result.current.handleMessageEvent({
        type: "message_created",
        data: makeMessage({
          id: "msg-think",
          role: "agent",
          text: "",
        }),
      })
    );

    expect(result.current.thinkingMessageId).toBe("msg-think");
    expect(result.current.messages).toHaveLength(0);
  });

  it("non-empty update for thinking message clears thinkingMessageId", () => {
    const { result } = setup();

    act(() =>
      result.current.handleMessageEvent({
        type: "message_created",
        data: makeMessage({
          id: "msg-think",
          role: "agent",
          text: "",
        }),
      })
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
      })
    );

    expect(result.current.thinkingMessageId).toBeNull();
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe("Thought complete");
  });

  it("vad event with state speech sets userState to speaking", () => {
    const { result } = setup();

    act(() =>
      result.current.handleMessageEvent({
        type: "vad",
        data: { state: "speech" },
      })
    );

    expect(result.current.userState).toBe("speaking");
  });

  it("vad event with silence sets userState to idle", () => {
    const { result } = setup();

    act(() =>
      result.current.handleMessageEvent({
        type: "vad",
        data: { state: "speech" },
      })
    );

    act(() =>
      result.current.handleMessageEvent({
        type: "vad",
        data: { state: "silence" },
      })
    );

    expect(result.current.userState).toBe("idle");
  });
});
