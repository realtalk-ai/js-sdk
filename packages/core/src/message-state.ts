import type {
  AnnotationItem,
  ConversationEvent,
  Message,
  UserState,
} from "./types.js";
import { EventType } from "./types.js";
import { sortChronological } from "./events.js";

export interface MessageState {
  messages: Message[];
  annotations: AnnotationItem[];
  userState: UserState;
  thinkingMessageId: string | null;
}

export interface MessageStateChange {
  state: MessageState;
  message?: Message;
  annotation?: AnnotationItem;
}

export const EMPTY_MESSAGE_STATE: MessageState = {
  messages: [],
  annotations: [],
  userState: "idle",
  thinkingMessageId: null,
};

function upsertById<T extends { id: string }>(
  items: T[],
  item: T,
  merge: (existing: T) => T = () => item,
): T[] {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [...items, item];
  const updated = [...items];
  updated[index] = merge(updated[index]);
  return updated;
}

export function applyMessageEvent(
  state: MessageState,
  event: ConversationEvent,
): MessageStateChange {
  switch (event.type) {
    case EventType.ExistingMessages: {
      const thinkingMessage = event.data.find(
        (message) => message.id === state.thinkingMessageId,
      );
      const isStillThinking =
        thinkingMessage !== undefined && !thinkingMessage.text?.trim();
      return {
        state: {
          ...state,
          messages: event.data,
          annotations: event.annotations ?? [],
          thinkingMessageId: isStillThinking ? state.thinkingMessageId : null,
        },
      };
    }
    case EventType.MessageCreated:
    case EventType.MessageUpdated: {
      const message = event.data;
      const isEmpty = message.role === "agent" && !message.text?.trim();
      const startsThinking = isEmpty && event.type === EventType.MessageCreated;
      if (startsThinking) {
        return { state: { ...state, thinkingMessageId: message.id } };
      }

      const stopsThinking = !isEmpty && state.thinkingMessageId === message.id;
      return {
        state: {
          ...state,
          thinkingMessageId: stopsThinking ? null : state.thinkingMessageId,
          messages: upsertById(state.messages, message, (existing) => ({
            ...existing,
            ...message,
          })),
        },
        message,
      };
    }
    case EventType.AnnotationCreated: {
      const annotation = event.data;
      return {
        state: {
          ...state,
          annotations: sortChronological(
            upsertById(state.annotations, annotation),
          ),
        },
        annotation,
      };
    }
    case EventType.Vad:
      return {
        state: {
          ...state,
          userState: event.data.state === "speech" ? "speaking" : "idle",
        },
      };
    default:
      return { state };
  }
}
