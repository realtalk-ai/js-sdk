import { Fragment, useEffect, useRef } from "react";
import {
  hasPendingSubTasks,
  type AgentState,
  type Message,
} from "@realtalk-ai/core";
import { formatMessageText, hasVisibleContent } from "../messages.js";
import { SubTasksBadge } from "./SubTasksBadge.js";

// Sub tasks are hidden but could be enabled to show progress on long running
// tasks we want to expose to end users, but all tasks are not relevant.
const SHOW_SUB_TASKS = false;

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

  const showingPendingSubTasks = SHOW_SUB_TASKS && hasPendingSubTasks(messages);
  const showThinking = agentState === "thinking" && !showingPendingSubTasks;

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
        const showSubTasks = SHOW_SUB_TASKS && subTasks.length > 0;
        return (
          <Fragment key={message.id}>
            {hasText && (
              <div className={`message ${message.role}`}>
                {formatMessageText(message.text)}
              </div>
            )}
            {showSubTasks && <SubTasksBadge subTasks={subTasks} />}
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
