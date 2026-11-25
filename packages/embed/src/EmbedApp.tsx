import { useEffect, useMemo, useRef, useState } from "react";
import { RealTalkProvider, useConversation } from "@realtalk-ai/react";
import { ConversationReconnectPolicy } from "@realtalk-ai/core";
import type { ConversationMode } from "@realtalk-ai/core";
import {
  createSessionMinter,
  resolveServer,
  ResumeRejectedError,
  type EmbedServer,
  type SessionMinter,
} from "./session.js";
import { useEmbedConfig } from "./hooks/useEmbedConfig.js";
import { useConversationExpiry } from "./hooks/useConversationExpiry.js";
import { useSounds, type WidgetSounds } from "./hooks/useSounds.js";
import { useUnreadMessages } from "./hooks/useUnreadMessages.js";
import { useOnline } from "./hooks/useOnline.js";
import { deriveWidgetStatus } from "./status.js";
import { wait } from "./wait.js";
import { AboutPage } from "./components/AboutPage.js";
import { Composer } from "./components/Composer.js";
import { Header } from "./components/Header.js";
import { Launcher } from "./components/Launcher.js";
import { WifiOffIcon } from "./components/icons.js";
import { MessageList } from "./components/MessageList.js";
import { NewConversation } from "./components/NewConversation.js";
import { SDK_INFO } from "./version.js";

const TEXT_ONLY: ConversationMode = { userAudio: false, agentAudio: false };
const AUDIO_BOTH_WAYS: ConversationMode = {
  userAudio: true,
  agentAudio: true,
};

export function EmbedApp({
  agentId,
  serverUrl,
  voiceDisabled = false,
  soundsDisabled = false,
}: {
  agentId: string;
  serverUrl: string;
  voiceDisabled?: boolean;
  soundsDisabled?: boolean;
}): JSX.Element {
  const server = useMemo(() => resolveServer(serverUrl), [serverUrl]);
  const minter = useMemo(
    () => createSessionMinter(server, agentId),
    [server, agentId],
  );

  return (
    <RealTalkProvider
      baseUrl={server.wsBaseUrl}
      getToken={minter.getToken}
      sdkInfo={SDK_INFO}
    >
      <Widget
        agentId={agentId}
        server={server}
        minter={minter}
        voiceDisabled={voiceDisabled}
        soundsDisabled={soundsDisabled}
      />
    </RealTalkProvider>
  );
}

function Widget({
  agentId,
  server,
  minter,
  voiceDisabled,
  soundsDisabled,
}: {
  agentId: string;
  server: EmbedServer;
  minter: SessionMinter;
  voiceDisabled: boolean;
  soundsDisabled: boolean;
}): JSX.Element | null {
  const config = useEmbedConfig(server, agentId);
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [starting, setStarting] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [previousChatEnded, setPreviousChatEnded] = useState(false);
  const [expired, setExpired] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [startMode, setStartMode] = useState<ConversationMode>(TEXT_ONLY);
  // Set further down, because the sounds need the conversation's messages.
  const soundsRef = useRef<WidgetSounds | null>(null);

  const conversation = useConversation({
    onModeRefused: (_requestedMode, currentMode) => {
      setStartMode(currentMode);
      setNotice("Voice is not available right now. Please try again later.");
    },
    onMessage: (message) => soundsRef.current?.onMessage(message),
    onAnnotation: (item) => soundsRef.current?.onAnnotation(item),
    onError: ({ error }) => {
      if (error instanceof ResumeRejectedError) setPreviousChatEnded(true);
    },
  });
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  const {
    status,
    connectionStatus,
    messages,
    annotations,
    timeline,
    agentState,
    userState,
    isMicEnabled: micOn,
  } = conversation;

  const startingRef = useRef(false);
  const unmountedRef = useRef(false);
  const resumeStoredConversation = async () => {
    const hasConversationToResume =
      minter.conversationId !== undefined && status === "not_started";
    if (!hasConversationToResume || startingRef.current) return;

    startingRef.current = true;
    setStarting(true);
    setResuming(true);
    const retryPolicy = new ConversationReconnectPolicy();
    const startedAt = Date.now();
    let lastError: unknown;
    try {
      for (let retryCount = 0; ; retryCount++) {
        if (unmountedRef.current) return;
        try {
          await conversationRef.current.startConversation({
            agentId,
            mode: startMode,
          });
          setNotice(null);
          return;
        } catch (error) {
          if (error instanceof ResumeRejectedError) {
            setPreviousChatEnded(true);
            return;
          }
          lastError = error;
        }
        const retryDelay = retryPolicy.nextRetryDelayMs({
          retryCount,
          elapsedMs: Date.now() - startedAt,
        });
        if (retryDelay === null) break;
        await wait(retryDelay);
      }
      console.error(
        "[realtalk-embed] failed to resume conversation",
        lastError,
      );
      setNotice("Your previous conversation could not be restored.");
    } finally {
      startingRef.current = false;
      setStarting(false);
      setResuming(false);
    }
  };
  const resumeStoredConversationRef = useRef(resumeStoredConversation);
  resumeStoredConversationRef.current = resumeStoredConversation;

  useEffect(() => {
    const resume = () => void resumeStoredConversationRef.current();
    const resumeWhenVisible = () => {
      if (document.visibilityState === "visible") resume();
    };

    unmountedRef.current = false;
    resume();
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resumeWhenVisible);
    return () => {
      unmountedRef.current = true;
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resumeWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (status === "finished") minter.reset();
  }, [status, minter]);

  const active = status === "active";
  const paused = status === "paused";
  const mode = active ? conversation.mode : startMode;
  const sounds = useSounds(open, mode.agentAudio, messages, soundsDisabled);
  soundsRef.current = sounds;
  const unreadCount = useUnreadMessages(
    conversation.conversationId,
    open,
    messages,
  );

  useConversationExpiry(paused, config, () => {
    minter.reset();
    setExpired(true);
  });

  if (!config) return null;

  const showVoice = config.voiceEnabled && !voiceDisabled;
  const conversationOver = status === "finished" || expired;
  const hasMessages = messages.length > 0;
  const ended = conversationOver && hasMessages;
  const audioOn = !ended && mode.agentAudio;
  const voiceOn = micOn || audioOn;
  const reconnecting = active && !starting && connectionStatus !== "connected";
  const offline = !online;
  const connectionNote = offline
    ? "You're offline. Check your connection"
    : resuming
      ? "Connecting to your conversation…"
      : reconnecting
        ? "Reconnecting…"
        : null;
  const conversationInProgress = (active || paused) && !expired;

  const start = async (mode: ConversationMode = startMode) => {
    if (startingRef.current || active) return;
    startingRef.current = true;
    setStarting(true);
    try {
      try {
        await conversationRef.current.startConversation({ agentId, mode });
      } catch (error) {
        if (!(error instanceof ResumeRejectedError)) throw error;
        setPreviousChatEnded(true);
        await conversationRef.current.startConversation({ agentId, mode });
      }
      setExpired(false);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const handleSend = async (text: string) => {
    sounds.unlock();
    setNotice(null);
    try {
      if (!active) await start();
      const sent = conversationRef.current.sendMessage(text);
      if (!sent) throw new Error("The conversation is not connected");
    } catch (error) {
      console.error("[realtalk-embed] failed to send message", error);
      setNotice("Your message was not sent. Please try again.");
      throw error;
    }
  };

  const handleEnd = async () => {
    try {
      await conversationRef.current.endConversation();
    } catch {
      // The server ends unreachable conversations on its own idle timeout.
    }
  };

  const handleStartNew = () => {
    minter.reset();
    conversationRef.current.clearMessages();
    setStartMode(TEXT_ONLY);
    setPreviousChatEnded(false);
    setExpired(false);
    setNotice(null);
  };

  // Applies a mode. Turning the mic on needs microphone access first and
  // starts the conversation if none is active; every other change is plain.
  const applyMode = async (newMode: ConversationMode) => {
    setNotice(null);
    const turnsMicOn = newMode.userAudio && !micOn;
    if (!turnsMicOn) {
      setStartMode(newMode);
      if (active) {
        await conversationRef.current.setMode(newMode);
      } else if (!newMode.userAudio) {
        conversationRef.current.disableMic();
      }
      return;
    }

    try {
      await conversationRef.current.setMode(newMode);
    } catch {
      setNotice(
        "Could not access the microphone. Check your browser permissions.",
      );
      return;
    }
    setStartMode(newMode);
    try {
      if (!active) await start(newMode);
    } catch (error) {
      console.error("[realtalk-embed] failed to start conversation", error);
      conversationRef.current.disableMic();
      setStartMode(mode);
      setNotice("Could not connect. Please try again.");
    }
  };

  const handleAudioToggle = () =>
    applyMode({ ...mode, agentAudio: !mode.agentAudio });

  const handleMicToggle = () => applyMode({ ...mode, userAudio: !micOn });

  const handleVoiceToggle = () =>
    applyMode(voiceOn ? TEXT_ONLY : AUDIO_BOTH_WAYS);

  const widgetStatus = deriveWidgetStatus({
    offline,
    starting,
    connectionStatus,
    ended,
    paused,
    active,
    agentState,
    userState,
    micOn,
    audioOn,
    annotations,
  });

  if (!open) {
    return (
      <div className="container">
        <Launcher
          conversationInProgress={conversationInProgress}
          unreadCount={unreadCount}
          onOpen={() => {
            sounds.unlock();
            setOpen(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="container">
      <div className="panel">
        <Header
          displayName={config.displayName}
          status={widgetStatus}
          showVoice={showVoice && !ended}
          micOn={micOn}
          audioOn={audioOn}
          canEnd={conversationInProgress}
          aboutOpen={showAbout}
          onToggleMic={() => void handleMicToggle()}
          onToggleAudio={() => void handleAudioToggle()}
          onEnd={() => void handleEnd()}
          onAbout={() => setShowAbout(true)}
          onBack={() => setShowAbout(false)}
          onMinimize={() => {
            setShowAbout(false);
            setOpen(false);
          }}
        />

        {showAbout ? (
          <AboutPage onBack={() => setShowAbout(false)} />
        ) : (
          <>
            <MessageList
              messages={messages}
              timeline={timeline}
              greeting={config.greeting}
              previousChatEnded={previousChatEnded}
              agentState={agentState}
              notice={notice}
              connecting={resuming}
            />
            {connectionNote && (
              <div
                className={`connection-bar${offline ? " offline" : ""}`}
                role="status"
              >
                {offline ? (
                  <WifiOffIcon />
                ) : (
                  <span className="connecting-spinner" />
                )}
                {connectionNote}
              </div>
            )}
            {ended ? (
              <NewConversation onStartNew={handleStartNew} />
            ) : (
              <Composer
                disabled={starting || reconnecting || offline}
                showVoice={showVoice}
                voiceOn={voiceOn}
                onSend={handleSend}
                onToggleVoice={() => void handleVoiceToggle()}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
