import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, MouseEvent } from "react";
import { SendIcon } from "./icons.js";

export function Composer({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string) => Promise<void>;
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
    if (event.target === event.currentTarget) textareaRef.current?.focus();
  };

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
          <button
            className="send"
            type="submit"
            aria-label="Send message"
            title="Send message"
            disabled={disabled || !hasText}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </form>
  );
}
