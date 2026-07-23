import type { Message } from "./types.js";

export function hasPendingSubTasks(messages: Message[]): boolean {
  const latestAgentMessage = [...messages]
    .reverse()
    .find((message) => message.role === "agent");
  const subTasks = latestAgentMessage?.metadata?.subTasks ?? [];
  return subTasks.some((subTask) => subTask.status === "pending");
}
