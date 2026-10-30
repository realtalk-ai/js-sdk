import { Fragment, useEffect, useRef } from "react";
import {
  hasPendingSubTasks,
  type AgentState,
  type Message,
  type TimelineItem,
} from "@realtalk-ai/core";
import { Markdown } from "@realtalk-ai/react";
import { formatMessageText, hasText, hasVisibleContent } from "../messages.js";
import { AiDisclaimer } from "./AiDisclaimer.js";
import { SubTasksBadge } from "./SubTasksBadge.js";

// Sub tasks are hidden but could be enabled to show progress on long running
// tasks we want to expose to end users, but all tasks are not relevant.
const SHOW_SUB_TASKS = false;

export function MessageList({
  messages,
  timeline,
  greeting,
  previousChatEnded,
  agentState,
  notice,
}: {
  messages: Message[];
  timeline: TimelineItem[];
  greeting: string;
  previousChatEnded: boolean;
  agentState: AgentState;
  notice: string | null;
}): JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [timeline, agentState]);

  const showingPendingSubTasks = SHOW_SUB_TASKS && hasPendingSubTasks(messages);
  const showThinking = agentState === "thinking" && !showingPendingSubTasks;

  return (
    <div className="messages" ref={listRef} aria-live="polite">
      {previousChatEnded && (
        <div className="finished-note">
          Your previous conversation ended, this is a new chat
        </div>
      )}
      <AiDisclaimer />
      {messages.length === 0 && <div className="message agent">{greeting}</div>}
      {timeline.map((item) => {
        switch (item.type) {
          case "message": {
            const { message } = item;
            if (!hasVisibleContent(message)) return null;
            const subTasks = message.metadata?.subTasks ?? [];
            const showSubTasks = SHOW_SUB_TASKS && subTasks.length > 0;
            return (
              <Fragment key={message.id}>
                {hasText(message) && (
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
          }
          case "annotation": {
            const { id, annotation } = item.annotation;
            switch (annotation.kind) {
              case "handoff_requested":
                return (
                  <div key={id} className="requested-note">
                    A human agent has been requested
                  </div>
                );
              case "human_agent_joined":
                return (
                  <div key={id} className="joined-note">
                    {annotation.humanAgentName ?? "A human agent"} has joined
                    the chat
                  </div>
                );
            }
          }
        }
      })}
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
