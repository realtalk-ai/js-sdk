import type { WidgetStatus } from "../status.js";
import {
  ChevronDownIcon,
  MicIcon,
  MicOffIcon,
  ResetIcon,
  SpeakerIcon,
  SpeakerOffIcon,
} from "./icons.js";

export function Header({
  displayName,
  status,
  isMicEnabled,
  isAudioMuted,
  canReset,
  onToggleMic,
  onToggleAudio,
  onReset,
  onMinimize,
}: {
  displayName: string;
  status: WidgetStatus;
  isMicEnabled: boolean;
  isAudioMuted: boolean;
  canReset: boolean;
  onToggleMic: () => void;
  onToggleAudio: () => void;
  onReset: () => void;
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
          onClick={onToggleMic}
        >
          {isMicEnabled ? <MicIcon /> : <MicOffIcon />}
        </button>
        <button
          className={`icon-button ${isAudioMuted ? "" : "active"}`}
          aria-label={audioLabel}
          title={audioLabel}
          onClick={onToggleAudio}
        >
          {isAudioMuted ? <SpeakerOffIcon /> : <SpeakerIcon />}
        </button>
        <button
          className="icon-button"
          aria-label="Reset chat"
          title="Reset chat"
          disabled={!canReset}
          onClick={onReset}
        >
          <ResetIcon />
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
