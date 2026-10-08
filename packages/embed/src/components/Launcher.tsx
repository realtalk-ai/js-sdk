import { ChatIcon } from "./icons.js";

export function Launcher({
  conversationInProgress,
  onOpen,
}: {
  conversationInProgress: boolean;
  onOpen: () => void;
}): JSX.Element {
  const label = conversationInProgress
    ? "Open chat, conversation in progress"
    : "Open chat";

  return (
    <button
      className="launcher"
      aria-label={label}
      title={label}
      onClick={onOpen}
    >
      <ChatIcon size={24} />
      {conversationInProgress && (
        <span className="launcher-badge" aria-hidden="true" />
      )}
    </button>
  );
}
