import humanAgentJoinedSound from "./assets/sounds/human-agent-joined.mp3?inline";
import messageSound from "./assets/sounds/message.mp3?inline";

export function bytesFromDataUrl(url: string): Uint8Array {
  const base64 = url.slice(url.indexOf(",") + 1);
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

// Start each file with about 50 ms of silence, because an output that wakes
// late clips the start of a sound.
export const MESSAGE_SOUND = bytesFromDataUrl(messageSound);
export const HUMAN_AGENT_JOINED_SOUND = bytesFromDataUrl(humanAgentJoinedSound);
