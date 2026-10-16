import { Fragment, useEffect, useRef } from "react";
import {
  hasPendingSubTasks,
  type AgentState,
  type Handoff,
  type Message,
} from "@realtalk-ai/core";
import {
  formatMessageText,
  hasVisibleContent,
  indexOfFirstMessageAfter,
} from "../messages.js";
import { SubTasksBadge } from "./SubTasksBadge.js";

// Sub tasks are hidden but could be enabled to show progress on long running
// tasks we want to expose to end users, but all tasks are not relevant.
const SHOW_SUB_TASKS = false;

export function MessageList({
  messages,
  greeting,
  previousChatEnded,
  agentState,
  handoff,
  notice,
}: {
  messages: Message[];
  greeting: string;
  previousChatEnded: boolean;
  agentState: AgentState;
  handoff: Handoff | null;
  notice: string | null;
}): JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, agentState, handoff]);

  const showingPendingSubTasks = SHOW_SUB_TASKS && hasPendingSubTasks(messages);
  const showThinking = agentState === "thinking" && !showingPendingSubTasks;

  const visibleMessages = messages.filter(hasVisibleContent);
  const joinedNote = handoff?.claimedAt
    ? {
        index: indexOfFirstMessageAfter(visibleMessages, handoff.claimedAt),
        element: (
          <div className="joined-note">
            {handoff.humanAgentName ?? "A human agent"} has joined the chat
          </div>
        ),
      }
    : null;

  return (
    <div className="messages" ref={listRef} aria-live="polite">
      {previousChatEnded && (
        <div className="finished-note">
          Your previous conversation ended, this is a new chat
        </div>
      )}
      {messages.length === 0 && <div className="message agent">{greeting}</div>}
      {visibleMessages.map((message, index) => {
        const hasText = Boolean(message.text?.trim());
        const subTasks = message.metadata?.subTasks ?? [];
        const showSubTasks = SHOW_SUB_TASKS && subTasks.length > 0;
        return (
          <Fragment key={message.id}>
            {index === joinedNote?.index && joinedNote.element}
            {hasText && (
              <div className={`message ${message.role}`}>
                {formatMessageText(message.text)}
              </div>
            )}
            {showSubTasks && <SubTasksBadge subTasks={subTasks} />}
          </Fragment>
        );
      })}
      {joinedNote?.index === -1 && joinedNote.element}
      {/* Always laid out so the list does not jump when thinking starts. */}
      <div
        className={`thinking ${showThinking ? "visible" : ""}`}
        aria-label={showThinking ? "Agent is thinking" : undefined}
        aria-hidden={!showThinking}
      >
        <span />
        <span />
        <span />
      </div>
      {notice && <div className="notice">{notice}</div>}
    </div>
  );
}
