import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import type { ReactNode } from "react";
import type { ConversationStatus, Message } from "@realtalk-ai/core";
import { EmbedApp, type EmbedAppProps } from "../src/EmbedApp.js";

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
    it("hides the voice buttons and starts as text when voice is disabled", async () => {
      await renderWidget({}, { voiceDisabled: true });
      openPanel();

      expect(
        screen.queryByRole("button", { name: "Enable microphone" }),
      ).toBeNull();
      expect(screen.queryByRole("button", { name: "Unmute audio" })).toBeNull();

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

      fireEvent.click(
        screen.getByRole("button", { name: "Enable microphone" }),
      );
      const micOnly = { userAudio: true, agentAudio: false };
      await vi.waitFor(() =>
        expect(conversation.startConversation).toHaveBeenCalledWith({
          agentId: AGENT_ID,
          mode: micOnly,
        }),
      );
      expect(conversation.setMode).toHaveBeenCalledWith(micOnly);
    });

    it("turns the agent audio on without touching the mic", async () => {
      await renderWidget();
      openPanel();

      fireEvent.click(screen.getByRole("button", { name: "Unmute audio" }));
      expect(screen.getByRole("button", { name: "Mute audio" })).toBeTruthy();
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

      fireEvent.click(screen.getByRole("button", { name: "Mute audio" }));
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

      fireEvent.click(
        screen.getByRole("button", { name: "Disable microphone" }),
      );
      expect(conversation.setMode).toHaveBeenCalledWith({
        userAudio: false,
        agentAudio: true,
      });
    });
  });

  describe("ending", () => {
    it("ends an active conversation and keeps the history", async () => {
      const { update } = await renderWidget({
        status: "active",
        messages: [message("m1", "Hello")],
      });
      openPanel();

      fireEvent.click(screen.getByRole("button", { name: "End conversation" }));
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

      fireEvent.click(screen.getByRole("button", { name: "End conversation" }));
      expect(conversation.endConversation).toHaveBeenCalledTimes(1);

      update({ status: "finished" });
      expect(screen.getByText("Conversation ended")).toBeTruthy();
      expect(
        sessionStorage.getItem(`realtalk-embed:conversation:${AGENT_ID}`),
      ).toBeNull();
    });

    it("disables the end button when no conversation is running", async () => {
      await renderWidget();
      openPanel();

      const endButton = screen.getByRole("button", {
        name: "End conversation",
      });
      expect(endButton.hasAttribute("disabled")).toBe(true);
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

    it("disables the mic and audio buttons until a new conversation is started", async () => {
      const { update } = await renderWidget({
        status: "finished",
        messages: [message("m1", "Bye")],
      });
      openPanel();

      const micButton = screen.getByRole("button", {
        name: "Enable microphone",
      });
      const audioButton = screen.getByRole("button", { name: "Unmute audio" });
      expect(micButton.hasAttribute("disabled")).toBe(true);
      expect(audioButton.hasAttribute("disabled")).toBe(true);

      fireEvent.click(micButton);
      expect(conversation.setMode).not.toHaveBeenCalled();
      expect(conversation.startConversation).not.toHaveBeenCalled();

      fireEvent.click(
        screen.getByRole("button", { name: "Start new conversation" }),
      );
      update({ messages: [] });
      expect(micButton.hasAttribute("disabled")).toBe(false);
      expect(audioButton.hasAttribute("disabled")).toBe(false);
    });

    it("shows the agent audio as off once the conversation has ended", async () => {
      const { update } = await renderWidget();
      openPanel();

      fireEvent.click(screen.getByRole("button", { name: "Unmute audio" }));
      expect(screen.getByRole("button", { name: "Mute audio" })).toBeTruthy();

      update({ status: "finished", messages: [message("m1", "Bye")] });
      const audioButton = screen.getByRole("button", { name: "Unmute audio" });
      expect(audioButton.hasAttribute("disabled")).toBe(true);
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
