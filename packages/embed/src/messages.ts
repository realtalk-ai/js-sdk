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
