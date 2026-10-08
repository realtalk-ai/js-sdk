import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, MouseEvent } from "react";
import { PhoneIcon, SendIcon } from "./icons.js";

export function Composer({
  disabled,
  voiceEnabled,
  voiceOn,
  onSend,
  onToggleVoice,
}: {
  disabled: boolean;
  voiceEnabled: boolean;
  voiceOn: boolean;
  onSend: (text: string) => Promise<void>;
  onToggleVoice: () => void;
}): JSX.Element {
  const [draft, setDraft] = useState("");
  const hasText = draft.trim() !== "";
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || disabled) return;
    setDraft("");
    try {
      await onSend(text);
    } catch {
      setDraft(text);
    }
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
            {voiceEnabled && (
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
