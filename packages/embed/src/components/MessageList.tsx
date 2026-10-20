import { Fragment, useEffect, useRef } from "react";
import {
  hasPendingSubTasks,
  type AgentState,
  type AnnotationItem,
  type Message,
} from "@realtalk-ai/core";
import { Markdown } from "@realtalk-ai/react";
import {
  AFTER_LAST_MESSAGE,
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
  annotations,
  greeting,
  previousChatEnded,
  agentState,
  notice,
}: {
  messages: Message[];
  annotations: AnnotationItem[];
  greeting: string;
  previousChatEnded: boolean;
  agentState: AgentState;
  notice: string | null;
}): JSX.Element {
  const visibleMessages = messages.filter(hasVisibleContent);
  const joinedNotes = annotations.flatMap(({ id, createdAt, annotation }) =>
    annotation.kind === "human_agent_joined"
      ? [
          {
            index: indexOfFirstMessageAfter(visibleMessages, createdAt),
            element: (
              <div key={id} className="joined-note">
                {annotation.humanAgentName ?? "A human agent"} has joined the
                chat
              </div>
            ),
          },
        ]
      : [],
  );
  const joinedNotesAt = (index: number) =>
    joinedNotes
      .filter((note) => note.index === index)
      .map((note) => note.element);

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, agentState, joinedNotes.length]);

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
      {visibleMessages.map((message, index) => {
        const hasText = Boolean(message.text?.trim());
        const subTasks = message.metadata?.subTasks ?? [];
        const showSubTasks = SHOW_SUB_TASKS && subTasks.length > 0;
        return (
          <Fragment key={message.id}>
            {joinedNotesAt(index)}
            {hasText && (
              <div className={`message ${message.role}`}>
                {message.role === "agent" ? (
                  <Markdown>{message.text}</Markdown>
                ) : (
                  formatMessageText(message.text)
                )}
              </div>
            )}
            {showSubTasks && <SubTasksBadge subTasks={subTasks} />}
          </Fragment>
        );
      })}
      {joinedNotesAt(AFTER_LAST_MESSAGE)}
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
