import { useState } from "react";
import type { FormEvent } from "react";
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

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Type a message…"
        autoComplete="off"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
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
