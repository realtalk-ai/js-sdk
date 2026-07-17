import { useEffect, useMemo, useRef, useState } from "react";
import { RealTalkProvider, useConversation } from "@realtalk-ai/react";
import {
  createSessionMinter,
  resolveServer,
  type EmbedServer,
  type SessionMinter,
} from "./session.js";
import { useEmbedConfig } from "./hooks/useEmbedConfig.js";
import { useConversationExpiry } from "./hooks/useConversationExpiry.js";
import { deriveWidgetStatus } from "./status.js";
import { Composer } from "./components/Composer.js";
import { Header } from "./components/Header.js";
import { MessageList } from "./components/MessageList.js";
import { ChatIcon } from "./components/icons.js";

export interface EmbedAppProps {
  agentId: string;
  serverUrl: string;
}

export function EmbedApp({ agentId, serverUrl }: EmbedAppProps): JSX.Element {
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
      <Widget agentId={agentId} server={server} minter={minter} />
    </RealTalkProvider>
  );
}

function Widget({
  agentId,
  server,
  minter,
}: {
  agentId: string;
  server: EmbedServer;
  minter: SessionMinter;
}): JSX.Element | null {
  const config = useEmbedConfig(server, agentId);
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [previousChatEnded, setPreviousChatEnded] = useState(false);
  const [expired, setExpired] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const conversation = useConversation({ startMuted: true });
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  const {
    status,
    connectionStatus,
    messages,
    agentState,
    userState,
    isAudioMuted,
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
          mode: "text",
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
  }, [open, status, agentId, minter]);

  useEffect(() => {
    if (status === "finished") minter.reset();
  }, [status, minter]);

  const active = status === "active";
  const paused = status === "paused";

  useConversationExpiry(paused, config, () => {
    minter.reset();
    setExpired(true);
  });

  if (!config) return null;

  const conversationOver = status === "finished" || expired;
  const hasMessages = messages.length > 0;
  const ended = conversationOver && hasMessages;
  const canReset = active || paused || ended;

  const start = async () => {
    if (starting || active) return;
    setStarting(true);
    const storedConversationId = minter.conversationId;
    try {
      await conversationRef.current.startConversation({
        agentId,
        mode: "text",
      });
      const resumeWasDropped =
        storedConversationId !== undefined &&
        minter.conversationId !== storedConversationId;
      if (resumeWasDropped || expired) setPreviousChatEnded(true);
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

  const handleReset = async () => {
    if (active || paused) {
      try {
        await conversationRef.current.endConversation();
      } catch {
        // The server ends unreachable conversations on its own idle timeout.
      }
    }
    minter.reset();
    conversationRef.current.clearMessages();
    conversationRef.current.setVolume(0);
    setPreviousChatEnded(false);
    setExpired(false);
    setNotice(null);
  };

  const handleMicToggle = async () => {
    if (isMicEnabled) {
      conversation.disableMic();
      return;
    }
    setNotice(null);
    try {
      await conversation.enableMic();
    } catch {
      setNotice(
        "Could not access the microphone. Check your browser permissions.",
      );
      return;
    }
    try {
      if (!active) await start();
    } catch (error) {
      console.error("[realtalk-embed] failed to start conversation", error);
      conversationRef.current.disableMic();
      setNotice("Could not connect. Please try again.");
    }
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
        <button
          className="launcher"
          aria-label="Open chat"
          onClick={() => setOpen(true)}
        >
          <ChatIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="panel">
        <Header
          displayName={config.displayName}
          status={widgetStatus}
          isMicEnabled={isMicEnabled}
          isAudioMuted={isAudioMuted}
          canReset={canReset}
          onToggleMic={() => void handleMicToggle()}
          onToggleAudio={conversation.toggleAudio}
          onReset={() => void handleReset()}
          onMinimize={() => setOpen(false)}
        />

        <MessageList
          messages={messages}
          greeting={config.greeting}
          previousChatEnded={previousChatEnded}
          agentState={agentState}
          notice={notice}
        />

        <Composer disabled={starting} onSend={handleSend} />
      </div>
    </div>
  );
}
