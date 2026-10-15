import { describe, it, expect } from "vitest";
import type { Message, SubTask, SubTaskStatus } from "../src/types.js";
import { hasPendingSubTasks, parseMessageMarkup } from "../src/messages.js";

function message(overrides: Partial<Message>): Message {
  return {
    id: "msg-1",
    role: "agent",
    text: "",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Message;
}

function subTask(id: string, name: string, status: SubTaskStatus): SubTask {
  return { id, name, type: "tool", context: {}, status };
}

describe("hasPendingSubTasks", () => {
  it("is false with no messages", () => {
    expect(hasPendingSubTasks([])).toBe(false);
  });

  it("only considers the latest agent message", () => {
    const messages = [
      message({
        id: "old",
        metadata: {
          subTasks: [subTask("t1", "look_up", "pending")],
        },
      }),
      message({ id: "latest", metadata: { subTasks: [] } }),
    ];
    expect(hasPendingSubTasks(messages)).toBe(false);
  });

  it("is true while the latest agent message has a pending sub-task", () => {
    const messages = [
      message({
        metadata: {
          subTasks: [
            subTask("t1", "look_up", "completed"),
            subTask("t2", "send_email", "pending"),
          ],
        },
      }),
      message({ id: "user-1", role: "user", text: "hi" }),
    ];
    expect(hasPendingSubTasks(messages)).toBe(true);
  });
});

describe("parseMessageMarkup", () => {
  it("returns plain text as one text segment", () => {
    expect(parseMessageMarkup("Hej! Hur kan jag hjälpa dig?")).toEqual([
      { type: "text", text: "Hej! Hur kan jag hjälpa dig?" },
    ]);
  });

  it("turns url tags into links with the label as text", () => {
    expect(
      parseMessageMarkup(
        'Se <url href="https://example.com/a">priser</url> och <url href="https://example.com/b?a=1&b=2">öppettider</url>.',
      ),
    ).toEqual([
      { type: "text", text: "Se " },
      { type: "url", href: "https://example.com/a", label: "priser" },
      { type: "text", text: " och " },
      {
        type: "url",
        href: "https://example.com/b?a=1&b=2",
        label: "öppettider",
      },
      { type: "text", text: "." },
    ]);
  });

  it("keeps bare URLs as text", () => {
    expect(parseMessageMarkup("Gå till https://example.com/boka.")).toEqual([
      { type: "text", text: "Gå till https://example.com/boka." },
    ]);
  });

  it("allows mailto and tel hrefs", () => {
    expect(
      parseMessageMarkup(
        '<url href="mailto:info@example.com">mejla</url> <url href="tel:+46701234567">ring</url>',
      ),
    ).toEqual([
      { type: "url", href: "mailto:info@example.com", label: "mejla" },
      { type: "text", text: " " },
      { type: "url", href: "tel:+46701234567", label: "ring" },
    ]);
  });

  it("keeps the label of a relative href as text", () => {
    expect(parseMessageMarkup('Se <url href="/priser">priser</url>.')).toEqual([
      { type: "text", text: "Se priser." },
    ]);
  });

  it.each(["javascript:alert(1)", "data:text/html,<b>hi</b>", "JavaScript:x"])(
    "keeps the label of a %s href as text",
    (href) => {
      expect(parseMessageMarkup(`<url href="${href}">klicka</url>`)).toEqual([
        { type: "text", text: "klicka" },
      ]);
    },
  );

  it("matches url tags in any case and with single quotes", () => {
    expect(
      parseMessageMarkup(
        "<URL href='https://example.com/a'>a</URL> <Url HREF=\"https://example.com/b\">b</Url>",
      ),
    ).toEqual([
      { type: "url", href: "https://example.com/a", label: "a" },
      { type: "text", text: " " },
      { type: "url", href: "https://example.com/b", label: "b" },
    ]);
  });

  it("matches url tags with an unquoted href and space in the closing tag", () => {
    expect(
      parseMessageMarkup(
        "Se <url href=https://example.com/a?b=1>vår sida</url >.",
      ),
    ).toEqual([
      { type: "text", text: "Se " },
      { type: "url", href: "https://example.com/a?b=1", label: "vår sida" },
      { type: "text", text: "." },
    ]);
  });

  it.each([
    '<url data-href="https://example.com">vår sida</url>',
    '<url title="href=https://example.com">vår sida</url>',
  ])("only reads a standalone href attribute in %s", (text) => {
    expect(parseMessageMarkup(text)).toEqual([
      { type: "text", text: "vår sida" },
    ]);
  });

  it("keeps the inner text of an unclosed url tag", () => {
    expect(
      parseMessageMarkup('Se <url href="https://example.com">vår sida'),
    ).toEqual([{ type: "text", text: "Se vår sida" }]);
  });

  it("keeps the inner text of other tags", () => {
    expect(
      parseMessageMarkup("Vi finns på <address>Storgatan 1</address>."),
    ).toEqual([{ type: "text", text: "Vi finns på Storgatan 1." }]);
  });

  it("keeps angle brackets that are not tags", () => {
    expect(parseMessageMarkup("Om a < b och b > c.")).toEqual([
      { type: "text", text: "Om a < b och b > c." },
    ]);
  });

  it.each([
    "Se <",
    "Se <ur",
    "Se </UR",
    "Se </url ",
    'Se <url href="https://x',
  ])("drops a partial url tag at the end of %s", (text) => {
    expect(parseMessageMarkup(text)).toEqual([{ type: "text", text: "Se " }]);
  });

  it("keeps a partial tag at the end that is not a url tag", () => {
    expect(parseMessageMarkup("Se <b")).toEqual([
      { type: "text", text: "Se <b" },
    ]);
  });
});
