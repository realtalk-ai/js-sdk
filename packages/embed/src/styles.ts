export const styles = `
:host {
  all: initial;
  --rt-accent: #2563eb;
  --rt-accent-hover: #1d4ed8;
  --rt-bg: #ffffff;
  --rt-fg: #111827;
  --rt-muted: #6b7280;
  --rt-border: #e5e7eb;
  --rt-agent-bg: #f3f4f6;
  --rt-danger: #dc2626;
  --rt-online: #16a34a;
  --rt-warn: #f59e0b;
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 999999;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
    Arial, sans-serif;
  color: var(--rt-fg);
}

button {
  font-family: inherit;
}

.container {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.launcher {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border: none;
  border-radius: 50%;
  background: var(--rt-accent);
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.launcher:hover {
  background: var(--rt-accent-hover);
}

.panel {
  display: flex;
  flex-direction: column;
  width: 360px;
  height: 520px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 120px);
  background: var(--rt-bg);
  border: 1px solid var(--rt-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--rt-border);
}

.header .title {
  font-weight: 600;
  font-size: 15px;
}

.header .status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 400;
  color: var(--rt-muted);
  margin-top: 2px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  background: var(--rt-muted);
}

.status.online .status-dot {
  background: var(--rt-online);
}

.status.live .status-dot {
  background: var(--rt-accent);
  animation: rt-pulse 1.4s infinite ease-in-out;
}

.status.connecting .status-dot {
  background: var(--rt-warn);
  animation: rt-pulse 1.4s infinite ease-in-out;
}

.status.paused .status-dot {
  background: var(--rt-warn);
}

@keyframes rt-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.header .actions {
  display: flex;
  gap: 4px;
}

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--rt-muted);
  cursor: pointer;
}

.icon-button:hover:not(:disabled) {
  background: var(--rt-agent-bg);
  color: var(--rt-fg);
}

.icon-button.active {
  color: var(--rt-accent);
}

.icon-button.danger {
  color: var(--rt-danger);
}

.icon-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message.user {
  align-self: flex-end;
  background: var(--rt-accent);
  color: #ffffff;
  border-bottom-right-radius: 4px;
}

.message.agent {
  align-self: flex-start;
  background: var(--rt-agent-bg);
  color: var(--rt-fg);
  border-bottom-left-radius: 4px;
}

.thinking {
  align-self: flex-start;
  display: flex;
  gap: 4px;
  padding: 12px;
}

.thinking span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--rt-muted);
  animation: rt-bounce 1.2s infinite ease-in-out;
}

.thinking span:nth-child(2) {
  animation-delay: 0.15s;
}

.thinking span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes rt-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

.subtasks {
  position: relative;
  align-self: flex-start;
}

.subtasks-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.subtasks-badge.pending {
  background: rgba(37, 99, 235, 0.1);
  color: var(--rt-accent);
}

.subtasks-badge.completed {
  background: rgba(22, 163, 74, 0.12);
  color: var(--rt-online);
}

.subtasks-details {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--rt-bg);
  border: 1px solid var(--rt-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  white-space: nowrap;
  z-index: 1;
}

.subtasks:hover .subtasks-details {
  display: flex;
}

.subtask {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  line-height: 1.3;
  color: var(--rt-muted);
}

.subtask.completed {
  color: var(--rt-fg);
}

.subtask-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex: none;
}

.subtask-spinner {
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  border: 2px solid var(--rt-border);
  border-top-color: var(--rt-accent);
  border-radius: 50%;
  animation: rt-spin 0.7s linear infinite;
}

.subtask-check {
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--rt-online);
  position: relative;
}

.subtask-check::after {
  content: "";
  position: absolute;
  left: 3.5px;
  top: 1.5px;
  width: 3px;
  height: 6px;
  border: solid #ffffff;
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}

@keyframes rt-spin {
  to { transform: rotate(360deg); }
}

.finished-note {
  align-self: center;
  font-size: 12px;
  color: var(--rt-muted);
  padding: 4px 0;
}

.notice {
  align-self: center;
  font-size: 12px;
  color: var(--rt-danger);
  padding: 4px 0;
  text-align: center;
}

.composer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--rt-border);
}

.composer input {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--rt-border);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  color: inherit;
  background: var(--rt-bg);
  outline: none;
}

.composer input:focus {
  border-color: var(--rt-accent);
}

.composer .send {
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  padding: 0 8px;
  border: none;
  border-radius: 8px;
  background: var(--rt-accent);
  color: #ffffff;
  cursor: pointer;
}

.composer .send:hover {
  background: var(--rt-accent-hover);
}

.composer .send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`;
