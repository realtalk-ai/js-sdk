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
import {
  buildTimeline,
  type AgentState,
  type AnnotationItem,
  type ConversationStatus,
  type Message,
  type TimelineItem,
} from "@realtalk-ai/core";
import { EmbedApp } from "../src/EmbedApp.js";
import packageJson from "../package.json";

type EmbedAppProps = ComponentProps<typeof EmbedApp>;

const AGENT_ID = "agent-1";
const IDLE_PAUSE_SECONDS = 30;
const IDLE_END_SECONDS = 300;
const HANDOFF_REQUESTED: AnnotationItem = {
  id: "a1",
  createdAt: "2024-01-01T00:00:15Z",
  annotation: { kind: "handoff_requested" },
};
const HUMAN_AGENT_JOINED: AnnotationItem = {
  id: "a2",
  createdAt: "2024-01-01T00:01:00Z",
  annotation: { kind: "human_agent_joined", humanAgentName: "Filip" },
};

const conversation = {
  status: "not_started" as ConversationStatus,
  connectionStatus: "disconnected" as const,
  messages: [] as Message[],
  annotations: [] as AnnotationItem[],
  get timeline(): TimelineItem[] {
    return buildTimeline(this.messages, this.annotations);
  },
  agentState: "idle" as AgentState,
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

const providerProps = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock("@realtalk-ai/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@realtalk-ai/react")>();
  return {
    Markdown: actual.Markdown,
    RealTalkProvider: ({
      children,
      ...props
    }: {
      children: ReactNode;
    } & Record<string, unknown>) => {
      providerProps.current = props;
      return children;
    },
    useConversation: () => conversation,
  };
});

function message(
  id: string,
  text: string,
  createdAt = "2024-01-01T00:00:00Z",
): Message {
  return { id, role: "agent", text, createdAt };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function mockFetch({ voiceEnabled = true } = {}) {
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
            voice_enabled: voiceEnabled,
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
      annotations: [],
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

  it("connects as the embed SDK with its package version", async () => {
    await renderWidget();

    expect(providerProps.current.sdkInfo).toEqual({
      name: "embed",
      version: packageJson.version,
      context: "embed_widget",
    });
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
    it("hides the voice controls when the agent has voice disabled", async () => {
      mockFetch({ voiceEnabled: false });
      await renderWidget();
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

    it("hides the voice controls when the snippet disables voice", async () => {
      await renderWidget({}, { voiceDisabled: true });
      openPanel();

      expect(
        screen.queryByRole("button", { name: "Enable voice mode" }),
      ).toBeNull();
      openHeaderMenu();
      expect(screen.queryByRole("menuitemcheckbox")).toBeNull();
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

  describe("messages", () => {
    it("renders agent messages as markdown", async () => {
      await renderWidget({
        status: "active",
        messages: [
          message("m1", "Läs mer på [vår sida](https://example.com/om)."),
        ],
      });
      openPanel();

      const link = screen.getByRole("link", { name: "vår sida" });
      expect(link.getAttribute("href")).toBe("https://example.com/om");
    });

    it("shows user messages as plain text", async () => {
      await renderWidget({
        status: "active",
        messages: [
          {
            ...message("m1", "Se [vår sida](https://example.com/om)"),
            role: "user",
          },
        ],
      });
      openPanel();

      expect(
        screen.getByText("Se [vår sida](https://example.com/om)"),
      ).toBeTruthy();
      expect(screen.queryByRole("link", { name: "vår sida" })).toBeNull();
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

  describe("handoff", () => {
    it("types out the handoff message before showing the waiting state", async () => {
      const { update } = await renderWidget({
        status: "active",
        agentState: "speaking",
        annotations: [HANDOFF_REQUESTED],
      });
      openPanel();
      expect(screen.getByText("Typing")).toBeTruthy();

      update({ agentState: "idle" });
      expect(screen.getByText("Waiting for human agent")).toBeTruthy();
    });

    it("goes back to Online and says who joined once a human agent has joined the chat", async () => {
      const { update } = await renderWidget({
        status: "active",
        messages: [message("m1", "Hello")],
        annotations: [HANDOFF_REQUESTED],
      });
      openPanel();
      expect(screen.getByText("Waiting for human agent")).toBeTruthy();
      expect(screen.queryByText(/has joined the chat/)).toBeNull();

      update({ annotations: [HANDOFF_REQUESTED, HUMAN_AGENT_JOINED] });
      expect(screen.getByText("Online")).toBeTruthy();
      expect(screen.queryByText("Waiting for human agent")).toBeNull();
      expect(screen.getByText("Filip has joined the chat")).toBeTruthy();
    });

    it("places the request note between the messages from before and after the request", async () => {
      await renderWidget({
        status: "active",
        messages: [
          message("m1", "Before"),
          message("m2", "After", "2024-01-01T00:00:30Z"),
        ],
        annotations: [HANDOFF_REQUESTED],
      });
      openPanel();

      const requestedNote = screen.getByText(
        "A human agent has been requested",
      );
      expect(
        screen.getByText("Before").closest(".message")?.nextElementSibling,
      ).toBe(requestedNote);
      expect(requestedNote.nextElementSibling).toBe(
        screen.getByText("After").closest(".message"),
      );
    });

    it("keeps the request note above the joined note once a human agent joins", async () => {
      await renderWidget({
        status: "active",
        messages: [message("m1", "Hello")],
        annotations: [HANDOFF_REQUESTED, HUMAN_AGENT_JOINED],
      });
      openPanel();

      expect(
        screen.getByText("A human agent has been requested").nextElementSibling,
      ).toBe(screen.getByText("Filip has joined the chat"));
    });

    it("still asks for a message while a waiting chat is paused", async () => {
      await renderWidget({
        status: "paused",
        annotations: [HANDOFF_REQUESTED],
      });
      openPanel();

      expect(screen.getByText("Still here")).toBeTruthy();
      expect(screen.queryByText("Waiting for human agent")).toBeNull();
    });

    it("says a human agent joined when there is no first name", async () => {
      await renderWidget({
        status: "active",
        messages: [message("m1", "Hello")],
        annotations: [
          {
            ...HUMAN_AGENT_JOINED,
            annotation: { kind: "human_agent_joined", humanAgentName: null },
          },
        ],
      });
      openPanel();

      expect(
        screen.getByText("A human agent has joined the chat"),
      ).toBeTruthy();
    });

    it("places the joined note between the messages from before and after the join", async () => {
      const beforeJoin = message("m1", "Before", "2024-01-01T00:00:30Z");
      const { update } = await renderWidget({
        status: "active",
        messages: [beforeJoin],
        annotations: [HUMAN_AGENT_JOINED],
      });
      openPanel();
      expect(
        screen.getByText("Before").closest(".message")?.nextElementSibling,
      ).toBe(screen.getByText("Filip has joined the chat"));

      update({
        messages: [beforeJoin, message("m2", "After", "2024-01-01T00:01:30Z")],
      });
      const joinedNote = screen.getByText("Filip has joined the chat");
      expect(
        screen.getByText("Before").closest(".message")?.nextElementSibling,
      ).toBe(joinedNote);
      expect(joinedNote.nextElementSibling).toBe(
        screen.getByText("After").closest(".message"),
      );
    });

    it("keeps the joined note when the chat ends and drops it on Start new", async () => {
      const { update } = await renderWidget({
        status: "finished",
        messages: [message("m1", "Bye")],
        annotations: [HUMAN_AGENT_JOINED],
      });
      openPanel();
      expect(screen.getByText("Conversation ended")).toBeTruthy();
      expect(screen.getByText("Filip has joined the chat")).toBeTruthy();

      conversation.clearMessages.mockImplementationOnce(() => {
        conversation.annotations = [];
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Start new conversation" }),
      );
      update({ messages: [] });
      expect(screen.queryByText("Filip has joined the chat")).toBeNull();
    });
  });
});
