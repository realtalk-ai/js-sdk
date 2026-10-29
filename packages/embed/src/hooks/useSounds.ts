import { useEffect, useRef, useState } from "react";
import type { AnnotationItem, Message } from "@realtalk-ai/core";
import { hasText } from "../messages.js";
import { createSoundPlayer } from "../sound-player.js";
import { HUMAN_AGENT_JOINED_SOUND, MESSAGE_SOUND } from "../sounds.js";

export interface WidgetSounds {
  unlock: () => void;
  onMessage: (message: Message) => void;
  onAnnotation: (item: AnnotationItem) => void;
}

function visitorIsLooking(open: boolean): boolean {
  return open && document.visibilityState === "visible" && document.hasFocus();
}

/**
 * Plays the message sound for a new agent message while the visitor is not
 * looking, and the join sound when a human agent joins. Pass `onMessage` and
 * `onAnnotation` to `useConversation`, which calls them only for live events,
 * and call `unlock` inside the visitor's own gestures.
 */
export function useSounds(
  open: boolean,
  agentAudio: boolean,
  renderedMessages: Message[],
  disabled: boolean,
): WidgetSounds {
  const [player] = useState(createSoundPlayer);
  const handledMessageIds = useRef(new Set<string>());
  const handledAnnotationIds = useRef(new Set<string>());

  useEffect(() => () => player.close(), [player]);

  const play = (sound: Uint8Array) => {
    if (!disabled && !agentAudio) void player.play(sound);
  };

  return {
    unlock: () => {
      if (!disabled) player.unlock();
    },
    onMessage: (message) => {
      if (message.role !== "agent" || !hasText(message)) return;
      if (handledMessageIds.current.has(message.id)) return;
      const textAlreadyShown = renderedMessages.some(
        (m) => m.id === message.id && hasText(m),
      );
      if (textAlreadyShown) return;
      handledMessageIds.current.add(message.id);
      if (!visitorIsLooking(open)) play(MESSAGE_SOUND);
    },
    onAnnotation: (item) => {
      if (item.annotation.kind !== "human_agent_joined") return;
      if (handledAnnotationIds.current.has(item.id)) return;
      handledAnnotationIds.current.add(item.id);
      play(HUMAN_AGENT_JOINED_SOUND);
    },
  };
}
