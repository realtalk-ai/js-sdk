import { useEffect } from "react";
import type { Message } from "@realtalk-ai/core";
import { hasText } from "../messages.js";
import { readLastSeenAt, storeLastSeenAt } from "../session.js";

function newestMessageAt(messages: Message[]): number | undefined {
  const times = messages
    .map((message) => Date.parse(message.createdAt))
    .filter((time) => !Number.isNaN(time));
  return times.length > 0 ? Math.max(...times) : undefined;
}

function isUnreadAgentMessage(message: Message, lastSeenAt: number): boolean {
  const isAgentText = message.role === "agent" && hasText(message);
  return isAgentText && Date.parse(message.createdAt) > lastSeenAt;
}

export function useUnreadMessages(
  conversationId: string | null,
  open: boolean,
  messages: Message[],
): number {
  const lastSeenAt = conversationId
    ? readLastSeenAt(conversationId)
    : undefined;
  const newestAt = newestMessageAt(messages);
  const hasSeenNothingYet = lastSeenAt === undefined;

  useEffect(() => {
    const hasNothingToMark = !conversationId || newestAt === undefined;
    if (hasNothingToMark) return;
    const marksAsSeen = open || hasSeenNothingYet;
    if (marksAsSeen) storeLastSeenAt(conversationId, newestAt);
  }, [conversationId, open, newestAt, hasSeenNothingYet]);

  if (open || hasSeenNothingYet) return 0;
  return messages.filter((message) => isUnreadAgentMessage(message, lastSeenAt))
    .length;
}
