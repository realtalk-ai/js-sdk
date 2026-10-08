import { EndIcon } from "./icons.js";
import { PopupMenu } from "./PopupMenu.js";

export function EndMenu({ onEnd }: { onEnd: () => void }): JSX.Element {
  return (
    <PopupMenu
      label="End conversation"
      icon={<EndIcon />}
      role="dialog"
      placement="below"
    >
      {(close) => (
        <div className="end-confirm">
          <div>End this conversation?</div>
          <button
            className="button-primary"
            type="button"
            onClick={() => {
              close();
              onEnd();
            }}
          >
            End
          </button>
        </div>
      )}
    </PopupMenu>
  );
}
