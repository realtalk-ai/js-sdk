import {
  ChatIcon,
  DotsIcon,
  InfoIcon,
  MicIcon,
  MicOffIcon,
  SpeakerIcon,
  SpeakerOffIcon,
} from "./icons.js";
import { PopupMenu } from "./PopupMenu.js";

export function MoreMenu({
  showVoice,
  isMicEnabled,
  isAudioMuted,
  aboutOpen,
  onToggleMic,
  onToggleAudio,
  onAbout,
  onBack,
}: {
  showVoice: boolean;
  isMicEnabled: boolean;
  isAudioMuted: boolean;
  aboutOpen: boolean;
  onToggleMic: () => void;
  onToggleAudio: () => void;
  onAbout: () => void;
  onBack: () => void;
}): JSX.Element {
  const isAudioOn = !isAudioMuted;

  return (
    <PopupMenu label="More" icon={<DotsIcon />} placement="below">
      {(close) => (
        <>
          {showVoice && (
            <>
              <button
                className={`popup-menu-item ${isMicEnabled ? "on" : ""}`}
                type="button"
                role="menuitemcheckbox"
                aria-checked={isMicEnabled}
                onClick={onToggleMic}
              >
                {isMicEnabled ? <MicIcon /> : <MicOffIcon />}
                Microphone
                <span className="state">{isMicEnabled ? "On" : "Off"}</span>
              </button>
              <button
                className={`popup-menu-item ${isAudioOn ? "on" : ""}`}
                type="button"
                role="menuitemcheckbox"
                aria-checked={isAudioOn}
                onClick={onToggleAudio}
              >
                {isAudioOn ? <SpeakerIcon /> : <SpeakerOffIcon />}
                Audio
                <span className="state">{isAudioOn ? "On" : "Off"}</span>
              </button>
              <div className="popup-menu-separator" />
            </>
          )}
          <button
            className="popup-menu-item"
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              if (aboutOpen) onBack();
              else onAbout();
            }}
          >
            {aboutOpen ? <ChatIcon /> : <InfoIcon />}
            {aboutOpen ? "Chat" : "About"}
          </button>
        </>
      )}
    </PopupMenu>
  );
}
