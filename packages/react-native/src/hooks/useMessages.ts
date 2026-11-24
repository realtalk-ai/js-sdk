import { useState, useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  Message,
  ConversationEvent,
  MessageState,
  UserState,
} from "@realtalk-ai/core";
import { applyMessageEvent, EMPTY_MESSAGE_STATE } from "@realtalk-ai/core";

export interface UseMessagesCallbacks {
  onMessage?: (message: Message) => void;
}

export interface UseMessagesReturn {
  messages: Message[];
  userState: UserState;
  thinkingMessageId: string | null;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  handleMessageEvent: (event: ConversationEvent) => void;
}

export function useMessages(callbacksRef: {
  readonly current: UseMessagesCallbacks;
}): UseMessagesReturn {
  const [state, setState] = useState<MessageState>(EMPTY_MESSAGE_STATE);
  const stateRef = useRef(state);

  const replaceState = useCallback((next: MessageState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const handleMessageEvent = useCallback(
    (event: ConversationEvent) => {
      const change = applyMessageEvent(stateRef.current, event);
      replaceState(change.state);
      if (change.message) callbacksRef.current.onMessage?.(change.message);
    },
    [callbacksRef, replaceState],
  );

  const setMessages = useCallback<Dispatch<SetStateAction<Message[]>>>(
    (action) => {
      const current = stateRef.current;
      const messages =
        typeof action === "function" ? action(current.messages) : action;
      replaceState({ ...current, messages });
    },
    [replaceState],
  );

  return {
    messages: state.messages,
    userState: state.userState,
    thinkingMessageId: state.thinkingMessageId,
    setMessages,
    handleMessageEvent,
  };
}
