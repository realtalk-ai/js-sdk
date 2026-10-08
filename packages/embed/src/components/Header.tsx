import type { WidgetStatus } from "../status.js";
import { EndMenu } from "./EndMenu.js";
import { ChevronDownIcon } from "./icons.js";
import { MoreMenu } from "./MoreMenu.js";

export function Header({
  displayName,
  status,
  showVoice,
  isMicEnabled,
  isAudioMuted,
  canEnd,
  aboutOpen,
  onToggleMic,
  onToggleAudio,
  onEnd,
  onAbout,
  onBack,
  onMinimize,
}: {
  displayName: string;
  status: WidgetStatus;
  showVoice: boolean;
  isMicEnabled: boolean;
  isAudioMuted: boolean;
  canEnd: boolean;
  aboutOpen: boolean;
  onToggleMic: () => void;
  onToggleAudio: () => void;
  onEnd: () => void;
  onAbout: () => void;
  onBack: () => void;
  onMinimize: () => void;
}): JSX.Element {
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
        {canEnd && <EndMenu onEnd={onEnd} />}
        <MoreMenu
          showVoice={showVoice}
          isMicEnabled={isMicEnabled}
          isAudioMuted={isAudioMuted}
          aboutOpen={aboutOpen}
          onToggleMic={onToggleMic}
          onToggleAudio={onToggleAudio}
          onAbout={onAbout}
          onBack={onBack}
        />
        <button
          className="icon-button"
          aria-label="Minimize chat"
          title="Minimize chat"
          onClick={onMinimize}
        >
          <ChevronDownIcon />
        </button>
      </div>
    </div>
  );
}
