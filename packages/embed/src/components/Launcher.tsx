import { ChatIcon } from "./icons.js";

function launcherLabel(
  conversationInProgress: boolean,
  unreadCount: number,
): string {
  if (unreadCount === 1) return "Open chat, 1 new message";
  if (unreadCount > 1) return `Open chat, ${unreadCount} new messages`;
  if (conversationInProgress) return "Open chat, conversation in progress";
  return "Open chat";
}

export function Launcher({
  conversationInProgress,
  unreadCount,
  onOpen,
}: {
  conversationInProgress: boolean;
  unreadCount: number;
  onOpen: () => void;
}): JSX.Element {
  const label = launcherLabel(conversationInProgress, unreadCount);
  const hasUnread = unreadCount > 0;

  return (
    <button
      className="launcher"
      aria-label={label}
      title={label}
      onClick={onOpen}
    >
      <ChatIcon size={24} />
      {hasUnread && (
        <span className="launcher-unread" aria-hidden="true">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
      {conversationInProgress && !hasUnread && (
        <span className="launcher-badge" aria-hidden="true" />
      )}
    </button>
  );
}
