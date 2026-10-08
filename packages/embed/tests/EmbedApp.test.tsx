import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  within,
} from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import type { ConversationStatus, Message } from "@realtalk-ai/core";
import { EmbedApp } from "../src/EmbedApp.js";

type EmbedAppProps = ComponentProps<typeof EmbedApp>;

const AGENT_ID = "agent-1";
const IDLE_PAUSE_SECONDS = 30;
const IDLE_END_SECONDS = 300;

const conversation = {
  status: "not_started" as ConversationStatus,
  connectionStatus: "disconnected" as const,
  messages: [] as Message[],
  agentState: "idle" as const,
  userState: "idle" as const,
  mode: { userAudio: false, agentAudio: false },
  isMicEnabled: false,
  isAudioMuted: false,
  startConversation: vi.fn(),
  endConversation: vi.fn(),
  clearMessages: vi.fn(),
  sendMessage: vi.fn(),
  setMode: vi.fn(),
  setVolume: vi.fn(),
  enableMic: vi.fn(),
  disableMic: vi.fn(),
  toggleAudio: vi.fn(),
};

vi.mock("@realtalk-ai/react", () => ({
  RealTalkProvider: ({ children }: { children: ReactNode }) => children,
  useConversation: () => conversation,
}));

function message(id: string, text: string): Message {
  return { id, role: "agent", text, createdAt: "2024-01-01T00:00:00Z" };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("/embed-configs/")) {
        return Promise.resolve(
          jsonResponse({
            display_name: "Support",
            greeting: "Hi there!",
            idle_pause_seconds: IDLE_PAUSE_SECONDS,
            idle_end_seconds: IDLE_END_SECONDS,
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({ token: "token", conversation_id: "conv-1" }),
      );
    }),
  );
}

function widget(props: Partial<EmbedAppProps> = {}) {
  return (
    <EmbedApp
      agentId={AGENT_ID}
      serverUrl="https://api.example.com"
      voiceEnabled
      {...props}
    />
  );
}

async function renderWidget(
  patch: Partial<typeof conversation> = {},
  props: Partial<EmbedAppProps> = {},
) {
  Object.assign(conversation, patch);
  const rendered = render(widget(props));
  await screen.findByRole("button", { name: /Open chat/ });

  const update = (next: Partial<typeof conversation>) => {
    Object.assign(conversation, next);
    rendered.rerender(widget(props));
  };

  return { ...rendered, update };
}

function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: /Open chat/ }));
}

function openHeaderMenu() {
  fireEvent.click(screen.getByRole("button", { name: "More" }));
}

function voiceToggle(name: RegExp): HTMLElement {
  return screen.getByRole("menuitemcheckbox", { name });
}

function endConversation() {
  fireEvent.click(screen.getByRole("button", { name: "End conversation" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "End" }),
  );
}

function launcherLabel(): string | null {
  return screen
    .getByRole("button", { name: /Open chat/ })
    .getAttribute("aria-label");
}

describe("EmbedApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockFetch();
    Object.assign(conversation, {
      status: "not_started",
      connectionStatus: "disconnected",
      messages: [],
      agentState: "idle",
      isMicEnabled: false,
      isAudioMuted: false,
      mode: { userAudio: false, agentAudio: false },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("launcher", () => {
    it("shows no dot before a conversation has started", async () => {
      await renderWidget();

      expect(launcherLabel()).toBe("Open chat");
    });

    it("shows a dot while a conversation is active or paused", async () => {
      const { update } = await renderWidget();

      update({ status: "active" });
      expect(launcherLabel()).toBe("Open chat, conversation in progress");

      update({ status: "paused" });
      expect(launcherLabel()).toBe("Open chat, conversation in progress");
    });

    it("shows no dot once the conversation is finished", async () => {
      await renderWidget({
        status: "finished",
        messages: [message("m1", "Bye")],
      });

      expect(launcherLabel()).toBe("Open chat");
    });
  });

  describe("composer", () => {
    it("disables the send button until there is text to send", async () => {
      await renderWidget();
      openPanel();

      const sendButton = screen.getByRole("button", { name: "Send message" });
      const textarea = screen.getByPlaceholderText("Type a message…");
      expect(sendButton.hasAttribute("disabled")).toBe(true);

      fireEvent.change(textarea, { target: { value: "   " } });
      expect(sendButton.hasAttribute("disabled")).toBe(true);

      fireEvent.change(textarea, { target: { value: "Hello" } });
      expect(sendButton.hasAttribute("disabled")).toBe(false);
    });
  });

  describe("voice", () => {
    it("hides the voice controls by default", async () => {
      render(
        <EmbedApp agentId={AGENT_ID} serverUrl="https://api.example.com" />,
      );
      await screen.findByRole("button", { name: /Open chat/ });
      openPanel();

      expect(
        screen.queryByRole("button", { name: "Enable voice mode" }),
      ).toBeNull();
      openHeaderMenu();
      expect(screen.queryByRole("menuitemcheckbox")).toBeNull();

      const textarea = screen.getByPlaceholderText("Type a message…");
      fireEvent.change(textarea, { target: { value: "Hello" } });
      fireEvent.submit(textarea.closest("form") as HTMLFormElement);
      await vi.waitFor(() =>
        expect(conversation.startConversation).toHaveBeenCalledWith({
          agentId: AGENT_ID,
          mode: { userAudio: false, agentAudio: false },
        }),
      );
    });

    it("turns the mic on without touching the agent audio", async () => {
      await renderWidget();
      openPanel();
      openHeaderMenu();

      fireEvent.click(voiceToggle(/Microphone/));
      const micOnly = { userAudio: true, agentAudio: false };
      await vi.waitFor(() =>
        expect(conversation.startConversation).toHaveBeenCalledWith({
          agentId: AGENT_ID,
          mode: micOnly,
        }),
      );
      expect(conversation.setMode).toHaveBeenCalledWith(micOnly);
      expect(conversation.sendMessage).not.toHaveBeenCalled();
    });

    it("turns the agent audio on without touching the mic", async () => {
      await renderWidget();
      openPanel();
      openHeaderMenu();

      fireEvent.click(voiceToggle(/Audio/));
      expect(voiceToggle(/Audio/).getAttribute("aria-checked")).toBe("true");
      expect(
        screen.getByRole("button", { name: "Disable voice mode" }).classList,
      ).toContain("active");
      expect(conversation.setMode).not.toHaveBeenCalled();

      const textarea = screen.getByPlaceholderText("Type a message…");
      fireEvent.change(textarea, { target: { value: "Hello" } });
      fireEvent.submit(textarea.closest("form") as HTMLFormElement);
      await vi.waitFor(() =>
        expect(conversation.startConversation).toHaveBeenCalledWith({
          agentId: AGENT_ID,
          mode: { userAudio: false, agentAudio: true },
        }),
      );
    });

    it("turns the agent audio off without touching the mic", async () => {
      await renderWidget({
        status: "active",
        isMicEnabled: true,
        mode: { userAudio: true, agentAudio: true },
      });
      openPanel();
      openHeaderMenu();

      fireEvent.click(voiceToggle(/Audio/));
      expect(conversation.setMode).toHaveBeenCalledWith({
        userAudio: true,
        agentAudio: false,
      });
      expect(conversation.toggleAudio).not.toHaveBeenCalled();
      expect(conversation.setVolume).not.toHaveBeenCalled();
    });

    it("turns the mic off without touching the agent audio", async () => {
      await renderWidget({
        status: "active",
        isMicEnabled: true,
        mode: { userAudio: true, agentAudio: true },
      });
      openPanel();
      openHeaderMenu();

      fireEvent.click(voiceToggle(/Microphone/));
      expect(conversation.setMode).toHaveBeenCalledWith({
        userAudio: false,
        agentAudio: true,
      });
    });
  });

  describe("voice toggle", () => {
    it("turns the mic and audio on together and off together", async () => {
      const { update } = await renderWidget();
      openPanel();

      fireEvent.click(
        screen.getByRole("button", { name: "Enable voice mode" }),
      );
      const both = { userAudio: true, agentAudio: true };
      await vi.waitFor(() =>
        expect(conversation.startConversation).toHaveBeenCalledWith({
          agentId: AGENT_ID,
          mode: both,
        }),
      );
      expect(conversation.setMode).toHaveBeenCalledWith(both);

      update({ status: "active", isMicEnabled: true, mode: both });
      const toggle = screen.getByRole("button", { name: "Disable voice mode" });

      fireEvent.click(toggle);
      expect(conversation.setMode).toHaveBeenLastCalledWith({
        userAudio: false,
        agentAudio: false,
      });
    });

    it("turns everything off when only the audio is on", async () => {
      await renderWidget({
        status: "active",
        isMicEnabled: false,
        mode: { userAudio: false, agentAudio: true },
      });
      openPanel();

      const toggle = screen.getByRole("button", { name: "Disable voice mode" });
      fireEvent.click(toggle);
      expect(conversation.setMode).toHaveBeenCalledWith({
        userAudio: false,
        agentAudio: false,
      });
    });
  });

  describe("voice menu", () => {
    it("shows whether the mic and audio are on", async () => {
      const { update } = await renderWidget();
      openPanel();
      expect(screen.queryByRole("menu")).toBeNull();

      openHeaderMenu();
      expect(voiceToggle(/Microphone/).getAttribute("aria-checked")).toBe(
        "false",
      );
      expect(voiceToggle(/Audio/).getAttribute("aria-checked")).toBe("false");

      update({
        status: "active",
        isMicEnabled: true,
        mode: { userAudio: true, agentAudio: true },
      });
      expect(voiceToggle(/Microphone/).getAttribute("aria-checked")).toBe(
        "true",
      );
      expect(voiceToggle(/Audio/).getAttribute("aria-checked")).toBe("true");
    });

    it("closes on Escape and on a click outside the menu", async () => {
      await renderWidget();
      openPanel();

      openHeaderMenu();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("menu")).toBeNull();

      openHeaderMenu();
      fireEvent.pointerDown(screen.getByPlaceholderText("Type a message…"));
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  describe("about page", () => {
    it("opens from the header menu and goes back to the chat", async () => {
      await renderWidget();
      openPanel();
      expect(screen.queryByRole("button", { name: "Back to chat" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "More" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "About" }));

      const link = screen.getByRole("link", { name: "callrealtalk.com" });
      expect(link.getAttribute("href")).toBe("https://callrealtalk.com");
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener nofollow");
      expect(screen.queryByText("Hi there!")).toBeNull();
      expect(screen.queryByPlaceholderText("Type a message…")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Back to chat" }));
      expect(screen.queryByRole("button", { name: "Back to chat" })).toBeNull();
      expect(screen.getByText("Hi there!")).toBeTruthy();
      expect(screen.getByPlaceholderText("Type a message…")).toBeTruthy();
    });

    it("offers the chat in the header menu while the page is open", async () => {
      await renderWidget();
      openPanel();

      fireEvent.click(screen.getByRole("button", { name: "More" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "About" }));

      fireEvent.click(screen.getByRole("button", { name: "More" }));
      expect(screen.queryByRole("menuitem", { name: "About" })).toBeNull();
      fireEvent.click(screen.getByRole("menuitem", { name: "Chat" }));
      expect(screen.getByText("Hi there!")).toBeTruthy();
    });

    it("is closed again when the chat is reopened", async () => {
      await renderWidget();
      openPanel();

      fireEvent.click(screen.getByRole("button", { name: "More" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "About" }));
      fireEvent.click(screen.getByRole("button", { name: "Minimize chat" }));
      openPanel();

      expect(screen.queryByRole("button", { name: "Back to chat" })).toBeNull();
      expect(screen.getByText("Hi there!")).toBeTruthy();
    });
  });

  describe("ending", () => {
    it("ends an active conversation and keeps the history", async () => {
      const { update } = await renderWidget({
        status: "active",
        messages: [message("m1", "Hello")],
      });
      openPanel();

      endConversation();
      expect(conversation.endConversation).toHaveBeenCalledTimes(1);

      update({ status: "finished" });
      expect(screen.getByText("Conversation ended")).toBeTruthy();
      expect(screen.getByText("Hello")).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Start new conversation" }),
      ).toBeTruthy();
      expect(screen.queryByPlaceholderText("Type a message…")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Minimize chat" }));
      expect(launcherLabel()).toBe("Open chat");
    });

    it("ends a paused conversation and forgets its stored id", async () => {
      sessionStorage.setItem(
        `realtalk-embed:conversation:${AGENT_ID}`,
        "conv-1",
      );
      const { update } = await renderWidget({
        status: "paused",
        messages: [message("m1", "Hello")],
      });
      openPanel();

      endConversation();
      expect(conversation.endConversation).toHaveBeenCalledTimes(1);

      update({ status: "finished" });
      expect(screen.getByText("Conversation ended")).toBeTruthy();
      expect(
        sessionStorage.getItem(`realtalk-embed:conversation:${AGENT_ID}`),
      ).toBeNull();
    });

    it("asks before ending and offers no end button without a conversation", async () => {
      const { update } = await renderWidget();
      openPanel();
      expect(
        screen.queryByRole("button", { name: "End conversation" }),
      ).toBeNull();

      update({ status: "active" });
      fireEvent.click(screen.getByRole("button", { name: "End conversation" }));
      expect(conversation.endConversation).not.toHaveBeenCalled();
      expect(screen.getByText("End this conversation?")).toBeTruthy();
    });
  });

  describe("ended conversation", () => {
    it("shows the status when the server finishes the conversation", async () => {
      await renderWidget({
        status: "finished",
        messages: [message("m1", "Bye")],
      });
      openPanel();

      expect(screen.getByText("Conversation ended")).toBeTruthy();
      expect(screen.getByText("Bye")).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Start new conversation" }),
      ).toBeTruthy();
    });

    it("starts over with a clean chat and no ended note", async () => {
      const { update } = await renderWidget({
        status: "finished",
        messages: [message("m1", "Bye")],
      });
      openPanel();

      fireEvent.click(
        screen.getByRole("button", { name: "Start new conversation" }),
      );
      expect(conversation.clearMessages).toHaveBeenCalledTimes(1);

      update({ messages: [] });
      expect(screen.getByText("Hi there!")).toBeTruthy();
      expect(screen.getByText("Online")).toBeTruthy();
      expect(screen.queryByText(/previous conversation ended/)).toBeNull();

      const textarea = screen.getByPlaceholderText("Type a message…");
      fireEvent.change(textarea, { target: { value: "Again" } });
      fireEvent.submit(textarea.closest("form") as HTMLFormElement);
      await vi.waitFor(() =>
        expect(conversation.startConversation).toHaveBeenCalledTimes(1),
      );
      expect(screen.queryByText(/previous conversation ended/)).toBeNull();
    });

    it("offers no voice controls until a new conversation is started", async () => {
      const { update } = await renderWidget({
        status: "finished",
        messages: [message("m1", "Bye")],
      });
      openPanel();

      expect(
        screen.queryByRole("button", { name: "Enable voice mode" }),
      ).toBeNull();
      openHeaderMenu();
      expect(screen.queryByRole("menuitemcheckbox")).toBeNull();
      fireEvent.keyDown(document, { key: "Escape" });

      fireEvent.click(
        screen.getByRole("button", { name: "Start new conversation" }),
      );
      update({ messages: [] });
      expect(
        screen.getByRole("button", { name: "Enable voice mode" }),
      ).toBeTruthy();
    });

    it("expires a paused conversation once the server idle window has passed", async () => {
      const { update } = await renderWidget({
        status: "active",
        messages: [message("m1", "Hello")],
      });
      openPanel();

      vi.useFakeTimers();
      update({ status: "paused" });
      expect(screen.getByText("Still here")).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(IDLE_END_SECONDS * 1000);
      });

      expect(screen.getByText("Conversation ended")).toBeTruthy();
      expect(screen.getByText("Hello")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Minimize chat" }));
      expect(launcherLabel()).toBe("Open chat");
    });
  });
});
