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
}

export interface UseMessagesReturn {
  messages: Message[];
  annotations: AnnotationItem[];
  userState: UserState;
  thinkingMessageId: string | null;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setAnnotations: Dispatch<SetStateAction<AnnotationItem[]>>;
  handleMessageEvent: (event: ConversationEvent) => void;
}

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
          setAnnotations(event.annotations);
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

          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === msg.id);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...msg };
              return updated;
            }
            return [...prev, msg];
          });
          callbacksRef.current.onMessage?.(msg);
          break;
        }
        case EventType.AnnotationCreated: {
          const item = event.data;
          if (!item) break;

          setAnnotations((prev) => {
            const idx = prev.findIndex((a) => a.id === item.id);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = item;
              return sortChronological(updated);
            }
            return sortChronological([...prev, item]);
          });
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

  return {
    messages,
    annotations,
    userState,
    thinkingMessageId,
    setMessages,
    setAnnotations,
    handleMessageEvent,
  };
}
