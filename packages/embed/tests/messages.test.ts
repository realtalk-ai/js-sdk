import { describe, it, expect } from "vitest";
import type { Message, SubTask, SubTaskStatus } from "@realtalk-ai/core";
import { formatMessageText, hasVisibleContent } from "../src/messages.js";

function message(overrides: Partial<Message>): Message {
  return {
    id: "msg-1",
    role: "agent",
    text: "",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Message;
}

function subTask(id: string, name: string, status: SubTaskStatus): SubTask {
  return { id, name, type: "tool", context: {}, status };
}

describe("formatMessageText", () => {
  it("collapses whitespace runs within lines", () => {
    expect(formatMessageText("Hello   there,  friend")).toBe(
      "Hello there, friend",
    );
  });

  it("keeps line breaks and trims each line", () => {
    expect(formatMessageText("  First line \n  Second   line ")).toBe(
      "First line\nSecond line",
    );
  });
});

describe("hasVisibleContent", () => {
  it("is false for a message with only whitespace text", () => {
    expect(hasVisibleContent(message({ text: "  \n " }))).toBe(false);
  });

  it("is true for a message with text", () => {
    expect(hasVisibleContent(message({ text: "Hello" }))).toBe(true);
  });

  it("is true for a text-less message with sub-tasks", () => {
    const withSubTasks = message({
      metadata: { subTasks: [subTask("t1", "look_up", "pending")] },
    });
    expect(hasVisibleContent(withSubTasks)).toBe(true);
  });
});
