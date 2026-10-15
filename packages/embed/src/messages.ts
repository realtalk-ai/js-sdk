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

export function indexOfFirstMessageAfter(
  messages: Message[],
  time: string,
): number {
  const after = new Date(time).getTime();
  return messages.findIndex(
    (message) => new Date(message.createdAt).getTime() > after,
  );
}
