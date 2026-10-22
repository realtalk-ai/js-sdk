import { useState, useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  AnnotationItem,
  Message,
  ConversationEvent,
  UserState,
} from "@realtalk-ai/core";
import { EventType, sortChronological } from "@realtalk-ai/core";

export interface UseMessagesCallbacks {
  onMessage?: (message: Message) => void;
  onAnnotation?: (item: AnnotationItem) => void;
}

export interface UseMessagesReturn {
  messages: Message[];
  annotations: AnnotationItem[];
  userState: UserState;
  thinkingMessageId: string | null;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  clearMessages: () => void;
  handleMessageEvent: (event: ConversationEvent) => void;
}

const upsertById = <T extends { id: string }>(
  items: T[],
  item: T,
  merge: (existing: T) => T = () => item,
): T[] => {
  const idx = items.findIndex((existing) => existing.id === item.id);
  if (idx !== -1) {
    const updated = [...items];
    updated[idx] = merge(updated[idx]);
    return updated;
  }
  return [...items, item];
};

export function useMessages(callbacksRef: {
  readonly current: UseMessagesCallbacks;
}): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [userState, setUserState] = useState<UserState>("idle");
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(
    null,
  );

  const handleMessageEvent = useCallback(
    (event: ConversationEvent) => {
      switch (event.type) {
        case EventType.ExistingMessages: {
          setMessages(event.data);
          setAnnotations(event.annotations ?? []);
          break;
        }
        case EventType.MessageCreated:
        case EventType.MessageUpdated: {
          const msg = event.data;
          const isEmpty = msg.role === "agent" && !msg.text?.trim();

          if (isEmpty && event.type === EventType.MessageCreated) {
            setThinkingMessageId(msg.id);
            break;
          }

          if (!isEmpty) {
            setThinkingMessageId((prev) => (prev === msg.id ? null : prev));
          }

          setMessages((prev) =>
            upsertById(prev, msg, (existing) => ({ ...existing, ...msg })),
          );
          callbacksRef.current.onMessage?.(msg);
          break;
        }
        case EventType.AnnotationCreated: {
          const item = event.data;
          setAnnotations((prev) => sortChronological(upsertById(prev, item)));
          callbacksRef.current.onAnnotation?.(item);
          break;
        }
        case EventType.Vad: {
          setUserState(event.data.state === "speech" ? "speaking" : "idle");
          break;
        }
      }
    },
    [callbacksRef],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setAnnotations([]);
  }, []);

  return {
    messages,
    annotations,
    userState,
    thinkingMessageId,
    setMessages,
    clearMessages,
    handleMessageEvent,
  };
}
