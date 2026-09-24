import { useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { SendIcon } from "./icons.js";

export function Composer({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string) => Promise<void>;
}): JSX.Element {
  const [draft, setDraft] = useState("");

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

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <textarea
        rows={1}
        placeholder="Type a message…"
        autoComplete="off"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={sendOnEnter}
      />
      <button
        className="send"
        type="submit"
        aria-label="Send message"
        title="Send message"
        disabled={disabled}
      >
        <SendIcon />
      </button>
    </form>
  );
}
