import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { Message } from "@realtalk-ai/core";
import { MessageList } from "../src/components/MessageList.js";

function renderMessage(role: Message["role"], text: string) {
  const message = {
    id: "m1",
    role,
    text,
    createdAt: "2024-01-01T00:00:00Z",
  } as Message;
  render(
    <MessageList
      messages={[message]}
      greeting=""
      previousChatEnded={false}
      agentState="idle"
      notice={null}
    />,
  );
}

describe("MessageList", () => {
  afterEach(cleanup);

  it("renders url tags in agent messages as links that open in a new tab", () => {
    renderMessage(
      "agent",
      'Se <url href="https://example.com/priser">våra priser</url>.',
    );

    const link = screen.getByRole("link", { name: "våra priser" });
    expect(link.getAttribute("href")).toBe("https://example.com/priser");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders unsafe hrefs as plain text", () => {
    renderMessage("agent", 'Se <url href="javascript:alert(1)">här</url>.');

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Se här.")).toBeTruthy();
  });

  it("shows user messages as written", () => {
    renderMessage("user", '<url href="https://example.com">x</url>');

    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.getByText('<url href="https://example.com">x</url>'),
    ).toBeTruthy();
  });
});
