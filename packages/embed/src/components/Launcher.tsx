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
    <button className="launcher" aria-label={label} onClick={onOpen}>
      <ChatIcon />
      {conversationInProgress && (
        <span className="launcher-badge" aria-hidden="true" />
      )}
    </button>
  );
}
