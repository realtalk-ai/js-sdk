import type { Message } from "./types.js";

export type MessageSegment =
  | { type: "text"; text: string }
  | { type: "url"; href: string; label: string };

// A quoted or unquoted value: "a b", 'a b' or a
const ATTRIBUTE_VALUE = String.raw`"[^"]*"|'[^']*'|[^\s>"']+`;
// Any number of attributes: ` href="/a" target=_blank`
const ATTRIBUTES = String.raw`(?:\s+[\w-]+(?:=(?:${ATTRIBUTE_VALUE}))?)*`;
// A whole url tag: <url href="https://example.com">label</url>
const URL_TAG_PATTERN = new RegExp(
  String.raw`<url(?<attributes>${ATTRIBUTES})\s*>(?<label>[\s\S]*?)<\/url\s*>`,
  "gi",
);
// Any opening, closing or self-closing tag: <b>, </b>, <br/>
const ANY_TAG_PATTERN = new RegExp(
  String.raw`<\/?[A-Za-z][\w-]*${ATTRIBUTES}\s*\/?>`,
  "g",
);
// The href value inside the attributes: href="https://example.com"
const HREF_PATTERN = new RegExp(
  String.raw`\bhref=(?<href>${ATTRIBUTE_VALUE})`,
  "i",
);
const SAFE_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"];

export function hasPendingSubTasks(messages: Message[]): boolean {
  const latestAgentMessage = [...messages]
    .reverse()
    .find((message) => message.role === "agent");
  const subTasks = latestAgentMessage?.metadata?.subTasks ?? [];
  return subTasks.some((subTask) => subTask.status === "pending");
}

export function parseMessageMarkup(text: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let position = 0;
  for (const match of text.matchAll(URL_TAG_PATTERN)) {
    const textBefore = stripMarkup(text.slice(position, match.index));
    segments.push({ type: "text", text: textBefore });
    const { attributes, label } = match.groups!;
    segments.push(parseUrlTag(attributes, label));
    position = match.index + match[0].length;
  }
  const textAfter = stripMarkup(text.slice(position));
  segments.push({ type: "text", text: textAfter });
  return mergeAdjacentText(segments);
}

function parseUrlTag(attributes: string, rawLabel: string): MessageSegment {
  const label = stripMarkup(rawLabel);
  const value = attributes.match(HREF_PATTERN)?.groups?.href ?? "";
  const rawHref = /^["']/.test(value) ? value.slice(1, -1) : value;
  const href = toSafeHref(rawHref.replace(/&amp;/g, "&"));
  if (!href) return { type: "text", text: label };
  return { type: "url", href, label: label || rawHref };
}

function stripMarkup(text: string): string {
  const withoutTags = text.replace(ANY_TAG_PATTERN, "");
  return stripPartialUrlTagAtEnd(withoutTags);
}

function stripPartialUrlTagAtEnd(text: string): string {
  const start = text.lastIndexOf("<");
  const tail = text.slice(start).toLowerCase();
  if (start === -1 || tail.includes(">")) return text;
  const isPartialUrlTag =
    "<url".startsWith(tail) || "</url".startsWith(tail) || /^<url\s/.test(tail);
  return isPartialUrlTag ? text.slice(0, start) : text;
}

function toSafeHref(href: string): string | null {
  try {
    const url = new URL(href);
    return SAFE_PROTOCOLS.includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function mergeAdjacentText(segments: MessageSegment[]): MessageSegment[] {
  const merged: MessageSegment[] = [];
  for (const segment of segments) {
    const previous = merged[merged.length - 1];
    if (segment.type === "text" && !segment.text) continue;
    if (segment.type === "text" && previous?.type === "text") {
      previous.text += segment.text;
      continue;
    }
    merged.push({ ...segment });
  }
  return merged;
}
