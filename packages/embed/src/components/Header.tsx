import type { WidgetStatus } from "../status.js";
import {
  ChevronDownIcon,
  EndIcon,
  MicIcon,
  MicOffIcon,
  SpeakerIcon,
  SpeakerOffIcon,
} from "./icons.js";

export function Header({
  displayName,
  status,
  isMicEnabled,
  isAudioMuted,
  canChangeMode,
  canEnd,
  onToggleMic,
  onToggleAudio,
  onEnd,
  onMinimize,
}: {
  displayName: string;
  status: WidgetStatus;
  isMicEnabled: boolean;
  isAudioMuted: boolean;
  canChangeMode: boolean;
  canEnd: boolean;
  onToggleMic: () => void;
  onToggleAudio: () => void;
  onEnd: () => void;
  onMinimize: () => void;
}): JSX.Element {
  const micLabel = isMicEnabled ? "Disable microphone" : "Enable microphone";
  const audioLabel = isAudioMuted ? "Unmute audio" : "Mute audio";

  return (
    <div className="header">
      <div>
        <div className="title">{displayName}</div>
        <div className={`status ${status.tone}`} title={status.hint}>
          <span className="status-dot" />
          {status.label}
        </div>
      </div>
      <div className="actions">
        <button
          className={`icon-button ${isMicEnabled ? "active" : ""}`}
          aria-label={micLabel}
          title={micLabel}
          disabled={!canChangeMode}
          onClick={onToggleMic}
        >
          {isMicEnabled ? <MicIcon /> : <MicOffIcon />}
        </button>
        <button
          className={`icon-button ${isAudioMuted ? "" : "active"}`}
          aria-label={audioLabel}
          title={audioLabel}
          disabled={!canChangeMode}
          onClick={onToggleAudio}
        >
          {isAudioMuted ? <SpeakerOffIcon /> : <SpeakerIcon />}
        </button>
        <button
          className="icon-button"
          aria-label="End conversation"
          title="End conversation"
          disabled={!canEnd}
          onClick={onEnd}
        >
          <EndIcon />
        </button>
        <button
          className="icon-button"
          aria-label="Minimize chat"
          onClick={onMinimize}
        >
          <ChevronDownIcon />
        </button>
      </div>
    </div>
  );
}
