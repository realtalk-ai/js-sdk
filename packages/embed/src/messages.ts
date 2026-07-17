import type { Message } from "@realtalk-ai/core";

export function formatMessageText(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .trim();
}

export function hasVisibleContent(message: Message): boolean {
  const hasText = Boolean(message.text?.trim());
  const hasSubTasks = (message.metadata?.subTasks?.length ?? 0) > 0;
  return hasText || hasSubTasks;
}

export function hasPendingSubTasks(messages: Message[]): boolean {
  const latestAgentMessage = [...messages]
    .reverse()
    .find((message) => message.role === "agent");
  const subTasks = latestAgentMessage?.metadata?.subTasks ?? [];
  return subTasks.some((subTask) => subTask.status === "pending");
}
