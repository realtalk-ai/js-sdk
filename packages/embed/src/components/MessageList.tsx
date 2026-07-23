import { Fragment, useEffect, useRef } from "react";
import {
  hasPendingSubTasks,
  type AgentState,
  type Message,
} from "@realtalk-ai/core";
import { formatMessageText, hasVisibleContent } from "../messages.js";
import { SubTasksBadge } from "./SubTasksBadge.js";

export function MessageList({
  messages,
  greeting,
  previousChatEnded,
  agentState,
  notice,
}: {
  messages: Message[];
  greeting: string;
  previousChatEnded: boolean;
  agentState: AgentState;
  notice: string | null;
}): JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, agentState]);

  const showThinking =
    agentState === "thinking" && !hasPendingSubTasks(messages);

  return (
    <div className="messages" ref={listRef} aria-live="polite">
      {previousChatEnded && (
        <div className="finished-note">
          Your previous conversation ended, this is a new chat
        </div>
      )}
      {messages.length === 0 && <div className="message agent">{greeting}</div>}
      {messages.filter(hasVisibleContent).map((message) => {
        const hasText = Boolean(message.text?.trim());
        const subTasks = message.metadata?.subTasks ?? [];
        return (
          <Fragment key={message.id}>
            {hasText && (
              <div className={`message ${message.role}`}>
                {formatMessageText(message.text)}
              </div>
            )}
            {subTasks.length > 0 && <SubTasksBadge subTasks={subTasks} />}
          </Fragment>
        );
      })}
      {showThinking && (
        <div className="thinking" aria-label="Agent is thinking">
          <span />
          <span />
          <span />
        </div>
      )}
      {notice && <div className="notice">{notice}</div>}
    </div>
  );
}
