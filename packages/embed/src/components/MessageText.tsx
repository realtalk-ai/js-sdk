import { parseMessageMarkup, type Message } from "@realtalk-ai/core";
import { formatMessageText } from "../messages.js";

export function MessageText({ message }: { message: Message }): JSX.Element {
  const text = formatMessageText(message.text);
  if (message.role !== "agent") return <>{text}</>;

  const segments = parseMessageMarkup(text);
  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "url" ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {segment.label}
          </a>
        ) : (
          segment.text
        ),
      )}
    </>
  );
}
