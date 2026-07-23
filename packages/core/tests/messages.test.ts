import { describe, it, expect } from "vitest";
import type { Message, SubTask, SubTaskStatus } from "../src/types.js";
import { hasPendingSubTasks } from "../src/messages.js";

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

describe("hasPendingSubTasks", () => {
  it("is false with no messages", () => {
    expect(hasPendingSubTasks([])).toBe(false);
  });

  it("only considers the latest agent message", () => {
    const messages = [
      message({
        id: "old",
        metadata: {
          subTasks: [subTask("t1", "look_up", "pending")],
        },
      }),
      message({ id: "latest", metadata: { subTasks: [] } }),
    ];
    expect(hasPendingSubTasks(messages)).toBe(false);
  });

  it("is true while the latest agent message has a pending sub-task", () => {
    const messages = [
      message({
        metadata: {
          subTasks: [
            subTask("t1", "look_up", "completed"),
            subTask("t2", "send_email", "pending"),
          ],
        },
      }),
      message({ id: "user-1", role: "user", text: "hi" }),
    ];
    expect(hasPendingSubTasks(messages)).toBe(true);
  });
});
