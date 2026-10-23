import humanAgentJoinedSound from "./assets/sounds/human-agent-joined.mp3?inline";
import messageSound from "./assets/sounds/message.mp3?inline";

export interface Sounds {
  message: Uint8Array | null;
  humanAgentJoined: Uint8Array | null;
}

export function bytesFromDataUrl(url: string): Uint8Array {
  const base64 = url.slice(url.indexOf(",") + 1);
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

// Set a sound to null to turn it off. Start each file with about 50 ms of
// silence, because an output that wakes late clips the start of a sound.
export const SOUNDS: Sounds = {
  message: bytesFromDataUrl(messageSound),
  humanAgentJoined: bytesFromDataUrl(humanAgentJoinedSound),
};
