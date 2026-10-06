export function NewConversation({
  onStartNew,
}: {
  onStartNew: () => void;
}): JSX.Element {
  return (
    <div className="composer">
      <button className="start-new" onClick={onStartNew}>
        Start new conversation
      </button>
    </div>
  );
}
