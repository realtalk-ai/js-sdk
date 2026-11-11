import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, MouseEvent } from "react";
import { PhoneIcon, SendIcon } from "./icons.js";

export function Composer({
  disabled,
  showVoice,
  voiceOn,
  onSend,
  onToggleVoice,
}: {
  disabled: boolean;
  showVoice: boolean;
  voiceOn: boolean;
  /** Resolves to whether the sent message showed up in the chat. */
  onSend: (text: string) => Promise<boolean>;
  onToggleVoice: () => void;
}): JSX.Element {
  const [draft, setDraft] = useState("");
  const hasText = draft.trim() !== "";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Set before the next render disables the form, so a burst of Enters sends once.
  const sendingRef = useRef(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const sentDraft = draft;
    const text = sentDraft.trim();
    if (!text || disabled || sendingRef.current) return;
    sendingRef.current = true;
    const shown = await onSend(text).finally(() => {
      sendingRef.current = false;
    });
    if (!shown) return;
    setDraft((current) =>
      current.startsWith(sentDraft) ? current.slice(sentDraft.length) : current,
    );
  };

  const sendOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    )
      return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const focusOnEmptyAreaClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    textareaRef.current?.focus();
  };

  const voiceLabel = voiceOn ? "Disable voice mode" : "Enable voice mode";

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="field">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Type a message…"
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={sendOnEnter}
        />
        <div className="field-actions" onClick={focusOnEmptyAreaClick}>
          <div className="field-actions-end">
            {showVoice && (
              <button
                className={`icon-button voice-toggle ${voiceOn ? "active" : ""}`}
                type="button"
                aria-label={voiceLabel}
                title={voiceLabel}
                onClick={onToggleVoice}
              >
                <PhoneIcon />
              </button>
            )}
            <button
              className="button-primary send"
              type="submit"
              aria-label="Send message"
              title="Send message"
              disabled={disabled || !hasText}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
