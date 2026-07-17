import { useEffect, useRef } from "react";
import type { EmbedConfig } from "../session.js";

const EXPIRY_BUFFER_SECONDS = 60;

/**
 * Ends a paused conversation locally once the server's idle window has
 * passed, since the server has no connection left to announce that it ended
 * it. Expires slightly early rather than risk resuming an already ended
 * conversation, and re-checks on tab visibility because background tabs
 * throttle timers.
 */
export function useConversationExpiry(
  paused: boolean,
  config: EmbedConfig | null,
  onExpire: () => void,
): void {
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!config || !paused) return;
    const remainingSeconds = Math.max(
      config.idleEndSeconds - config.idlePauseSeconds - EXPIRY_BUFFER_SECONDS,
      0,
    );
    const deadline = Date.now() + remainingSeconds * 1000;
    const expire = () => onExpireRef.current();
    const timer = setTimeout(expire, remainingSeconds * 1000);
    const handleVisibilityChange = () => {
      if (Date.now() >= deadline) expire();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [paused, config]);
}
