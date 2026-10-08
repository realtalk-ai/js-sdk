import { useEffect, useMemo, useRef, useState } from "react";
import { RealTalkProvider, useConversation } from "@realtalk-ai/react";
import type { ConversationMode } from "@realtalk-ai/core";
import {
  createSessionMinter,
  resolveServer,
  type EmbedServer,
  type SessionMinter,
} from "./session.js";
import { useEmbedConfig } from "./hooks/useEmbedConfig.js";
import { useConversationExpiry } from "./hooks/useConversationExpiry.js";
import { deriveWidgetStatus } from "./status.js";
import { AboutPage } from "./components/AboutPage.js";
import { Composer } from "./components/Composer.js";
import { Header } from "./components/Header.js";
import { Launcher } from "./components/Launcher.js";
import { MessageList } from "./components/MessageList.js";
import { NewConversation } from "./components/NewConversation.js";

const TEXT_ONLY: ConversationMode = { userAudio: false, agentAudio: false };

export function EmbedApp({
  agentId,
  serverUrl,
  voiceEnabled = false,
}: {
  agentId: string;
  serverUrl: string;
  voiceEnabled?: boolean;
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
      context="embed_widget"
    >
      <Widget
        agentId={agentId}
        server={server}
        minter={minter}
        voiceEnabled={voiceEnabled}
      />
    </RealTalkProvider>
  );
}

function Widget({
  agentId,
  server,
  minter,
  voiceEnabled,
}: {
  agentId: string;
  server: EmbedServer;
  minter: SessionMinter;
  voiceEnabled: boolean;
}): JSX.Element | null {
  const config = useEmbedConfig(server, agentId);
  const [open, setOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [starting, setStarting] = useState(false);
  const [previousChatEnded, setPreviousChatEnded] = useState(false);
  const [expired, setExpired] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [startMode, setStartMode] = useState<ConversationMode>(TEXT_ONLY);

  const conversation = useConversation({
    onModeRefused: (_requestedMode, currentMode) => {
      setStartMode(currentMode);
      setNotice("Voice is not available right now. Please try again later.");
    },
  });
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  const {
    status,
    connectionStatus,
    messages,
    agentState,
    userState,
    isMicEnabled,
  } = conversation;

  const firstOpenHandledRef = useRef(false);
  useEffect(() => {
    if (!open || firstOpenHandledRef.current) return;
    firstOpenHandledRef.current = true;

    const storedConversationId = minter.conversationId;
    const hasConversationToResume =
      storedConversationId !== undefined && status === "not_started";
    if (!hasConversationToResume) return;

    const resumeConversation = async () => {
      setStarting(true);
      try {
        await conversationRef.current.startConversation({
          agentId,
          mode: startMode,
        });
        const resumeWasDropped = minter.conversationId !== storedConversationId;
        if (resumeWasDropped) setPreviousChatEnded(true);
      } catch (error) {
        console.error("[realtalk-embed] failed to resume conversation", error);
        setNotice("Your previous conversation could not be restored.");
      } finally {
        setStarting(false);
      }
    };
    void resumeConversation();
  }, [open, status, agentId, minter, startMode]);

  useEffect(() => {
    if (status === "finished") minter.reset();
  }, [status, minter]);

  const active = status === "active";
  const paused = status === "paused";
  const mode = active ? conversation.mode : startMode;

  useConversationExpiry(paused, config, () => {
    minter.reset();
    setExpired(true);
  });

  if (!config) return null;

  const conversationOver = status === "finished" || expired;
  const hasMessages = messages.length > 0;
  const ended = conversationOver && hasMessages;
  const isAudioMuted = ended || !mode.agentAudio;
  const voiceOn = isMicEnabled || !isAudioMuted;
  const conversationInProgress = (active || paused) && !expired;

  const start = async (mode: ConversationMode = startMode) => {
    if (starting || active) return;
    setStarting(true);
    const storedConversationId = minter.conversationId;
    try {
      await conversationRef.current.startConversation({ agentId, mode });
      const resumeWasDropped =
        storedConversationId !== undefined &&
        minter.conversationId !== storedConversationId;
      if (resumeWasDropped) setPreviousChatEnded(true);
      setExpired(false);
    } finally {
      setStarting(false);
    }
  };

  const handleSend = async (text: string) => {
    setNotice(null);
    try {
      if (!active) await start();
      conversationRef.current.sendMessage(text);
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

  const changeMode = async (newMode: ConversationMode) => {
    setStartMode(newMode);
    if (active) {
      await conversationRef.current.setMode(newMode);
    } else if (!newMode.userAudio) {
      conversationRef.current.disableMic();
    }
  };

  const handleAudioToggle = async () => {
    setNotice(null);
    await changeMode({ ...mode, agentAudio: !mode.agentAudio });
  };

  const turnMicOn = async (
    withMic: ConversationMode,
    fallback: ConversationMode,
  ) => {
    try {
      await conversation.setMode(withMic);
    } catch {
      setNotice(
        "Could not access the microphone. Check your browser permissions.",
      );
      return;
    }
    setStartMode(withMic);
    try {
      if (!active) await start(withMic);
    } catch (error) {
      console.error("[realtalk-embed] failed to start conversation", error);
      conversationRef.current.disableMic();
      setStartMode(fallback);
      setNotice("Could not connect. Please try again.");
    }
  };

  const handleMicToggle = async () => {
    setNotice(null);
    const withoutMic = { ...mode, userAudio: false };
    if (isMicEnabled) {
      await changeMode(withoutMic);
      return;
    }
    await turnMicOn({ ...mode, userAudio: true }, withoutMic);
  };

  const handleVoiceToggle = async () => {
    setNotice(null);
    if (voiceOn) {
      await changeMode(TEXT_ONLY);
      return;
    }
    await turnMicOn({ userAudio: true, agentAudio: true }, TEXT_ONLY);
  };

  const widgetStatus = deriveWidgetStatus({
    starting,
    connectionStatus,
    ended,
    paused,
    active,
    agentState,
    userState,
    isAudioMuted,
    isMicEnabled,
  });

  if (!open) {
    return (
      <div className="container">
        <Launcher
          conversationInProgress={conversationInProgress}
          onOpen={() => setOpen(true)}
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
          showVoice={voiceEnabled && !ended}
          isMicEnabled={isMicEnabled}
          isAudioMuted={isAudioMuted}
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
              greeting={config.greeting}
              previousChatEnded={previousChatEnded}
              agentState={agentState}
              notice={notice}
            />
            {ended ? (
              <NewConversation onStartNew={handleStartNew} />
            ) : (
              <Composer
                disabled={starting}
                voiceEnabled={voiceEnabled}
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
