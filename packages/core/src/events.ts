import type {
  BackendMessage,
  ClientEvent,
  Message,
  MessageMetadata,
  ToolCall,
  ToolResult,
  ConversationEvent,
  UserMessageLatencies,
  AssistantMessageLatencies,
} from "./types.js";

// --- EventEmitter ---

type EventCallback = (...args: unknown[]) => void;

interface OnceCallback extends EventCallback {
  _original?: EventCallback;
}

export class EventEmitter<
  T extends Record<string, unknown[]> = Record<string, unknown[]>
> {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on<K extends keyof T & string>(
    event: K,
    callback: (...args: T[K]) => void
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);
  }

  once<K extends keyof T & string>(
    event: K,
    callback: (...args: T[K]) => void
  ): void {
    const wrapped: OnceCallback = (...args: unknown[]) => {
      this.listeners.get(event)?.delete(wrapped);
      (callback as EventCallback)(...args);
    };
    wrapped._original = callback as EventCallback;
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(wrapped);
  }

  off<K extends keyof T & string>(
    event: K,
    callback: (...args: T[K]) => void
  ): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;
    for (const listener of listeners) {
      if (
        listener === callback ||
        (listener as OnceCallback)._original === callback
      ) {
        listeners.delete(listener);
        return;
      }
    }
  }

  emit<K extends keyof T & string>(event: K, ...args: T[K]): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(...args);
      } catch (error) {
        console.error("[realtalk] unhandled_listener_error", { event, error });
      }
    });
  }

  removeAllListeners(event?: keyof T & string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// --- Message normalization ---

function normalizeLatencies(
  raw: Record<string, number>
): UserMessageLatencies | AssistantMessageLatencies {
  if ("transcription_ms" in raw) {
    return { transcriptionMs: raw.transcription_ms };
  }
  return {
    firstSentenceLlmMs: raw.first_sentence_llm_ms,
    firstSentenceTtsMs: raw.first_sentence_tts_ms,
    userSilenceToSpeechMs: raw.user_silence_to_speech_ms,
  };
}

function normalizeMetadata(
  raw: BackendMessage["metadata"]
): MessageMetadata | undefined {
  if (!raw) return undefined;
  return {
    type: raw.type,
    interrupted: raw.interrupted,
    intent: raw.intent,
    ragDocumentsUsed: raw.rag_documents_used,
    toolCalls: raw.tool_calls?.map(
      (tc): ToolCall => ({
        id: tc.id,
        function: tc.function,
      })
    ),
    toolResults: raw.tool_results?.map(
      (tr): ToolResult => ({
        toolCallId: tr.tool_call_id,
        type: tr.type,
        role: tr.role,
        name: tr.name,
        content: tr.content,
      })
    ),
    latencies: raw.latencies ? normalizeLatencies(raw.latencies) : undefined,
  };
}

export const normalizeMessage = (raw: BackendMessage): Message => ({
  id: raw.id,
  role: raw.sender === "Agent" ? "agent" : "user",
  text: raw.text,
  createdAt: raw.timestamp,
  metadata: normalizeMetadata(raw.metadata),
  hasBeenAnswered: raw.has_been_answered,
  shouldBeAnswered: raw.should_be_answered,
});

export const sortChronological = (msgs: Message[]): Message[] =>
  [...msgs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

// --- Event conversion ---

const CLIENT_TO_WIRE_TYPES: Record<string, string> = {
  message: "web_message",
};

export function convertEventForTransport(
  event: ClientEvent
): Record<string, unknown> {
  if ("type" in event && CLIENT_TO_WIRE_TYPES[event.type]) {
    return { ...event, type: CLIENT_TO_WIRE_TYPES[event.type] };
  }
  return event;
}

export function convertEventForSDK(
  raw: Record<string, unknown>
): ConversationEvent {
  switch (raw.type) {
    case "existing_messages":
      return {
        type: "existing_messages",
        data: sortChronological(
          (raw.data as BackendMessage[]).map(normalizeMessage)
        ),
      };
    case "message_created":
      return {
        type: "message_created",
        data: normalizeMessage(raw.data as BackendMessage),
      };
    case "message_updated":
      return {
        type: "message_updated",
        data: normalizeMessage(raw.data as BackendMessage),
      };
    default:
      return raw as ConversationEvent;
  }
}
