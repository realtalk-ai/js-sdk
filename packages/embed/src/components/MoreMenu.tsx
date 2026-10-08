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
  micOn,
  audioOn,
  aboutOpen,
  onToggleMic,
  onToggleAudio,
  onAbout,
  onBack,
}: {
  showVoice: boolean;
  micOn: boolean;
  audioOn: boolean;
  aboutOpen: boolean;
  onToggleMic: () => void;
  onToggleAudio: () => void;
  onAbout: () => void;
  onBack: () => void;
}): JSX.Element {
  return (
    <PopupMenu label="More" icon={<DotsIcon />} placement="below">
      {(close) => (
        <>
          {showVoice && (
            <>
              <button
                className={`popup-menu-item ${micOn ? "on" : ""}`}
                type="button"
                role="menuitemcheckbox"
                aria-checked={micOn}
                onClick={onToggleMic}
              >
                {micOn ? <MicIcon /> : <MicOffIcon />}
                Microphone
                <span className="state">{micOn ? "On" : "Off"}</span>
              </button>
              <button
                className={`popup-menu-item ${audioOn ? "on" : ""}`}
                type="button"
                role="menuitemcheckbox"
                aria-checked={audioOn}
                onClick={onToggleAudio}
              >
                {audioOn ? <SpeakerIcon /> : <SpeakerOffIcon />}
                Audio
                <span className="state">{audioOn ? "On" : "Off"}</span>
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
