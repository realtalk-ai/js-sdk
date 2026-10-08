import { WIDGET_BACKGROUND, WIDGET_FOREGROUND } from "./theme.js";

export const styles = `
:host {
  all: initial;
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 999999;
}

.theme {
  --rt-accent: #000000;
  --rt-accent-fg: #ffffff;
  --rt-accent-ink: var(--rt-accent);
  --rt-accent-hover: color-mix(in srgb, var(--rt-accent) 85%, var(--rt-accent-fg));
  --rt-accent-subtle: color-mix(in srgb, var(--rt-accent) 10%, transparent);
  --rt-bg: ${WIDGET_BACKGROUND};
  --rt-fg: ${WIDGET_FOREGROUND};
  --rt-muted: #6b7280;
  --rt-border: #e5e7eb;
  --rt-agent-bg: #f3f4f6;
  --rt-danger: #dc2626;
  --rt-online: #16a34a;
  --rt-online-fg: #ffffff;
  --rt-online-subtle: color-mix(in srgb, var(--rt-online) 12%, transparent);
  --rt-warn: #f59e0b;
  --rt-radius: 12px;
  --rt-radius-sm: 8px;
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
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 50%;
  background: var(--rt-accent);
  color: var(--rt-accent-fg);
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s ease;
}

.launcher:hover {
  background: var(--rt-accent-hover);
  transform: scale(1.06);
}

.launcher-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--rt-online);
}

.launcher-badge::before {
  --rt-ring-scale: 2;
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  border-radius: 50%;
  background: var(--rt-online);
  animation: rt-pulse-ring 1.2s ease infinite;
  pointer-events: none;
}

.panel {
  display: flex;
  flex-direction: column;
  width: 360px;
  height: 540px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 40px);
  max-height: calc(100dvh - 40px);
  background: var(--rt-bg);
  border: 1px solid var(--rt-border);
  border-radius: var(--rt-radius);
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
  position: relative;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
  background: var(--rt-muted);
}

.status.online .status-dot,
.status.live .status-dot {
  background: var(--rt-online);
}

.status.live .status-dot::before {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  border-radius: 50%;
  background: var(--rt-online);
  animation: rt-pulse-ring 1.2s ease infinite;
  pointer-events: none;
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

@keyframes rt-pulse-ring {
  0% { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(var(--rt-ring-scale, 3)); opacity: 0; }
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
  border-radius: var(--rt-radius-sm);
  background: transparent;
  color: var(--rt-muted);
  cursor: pointer;
}

.icon-button:hover:not(:disabled) {
  background: var(--rt-agent-bg);
  color: var(--rt-fg);
}

.icon-button.active {
  background: var(--rt-accent-subtle);
  color: var(--rt-accent-ink);
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
  padding: 12px 12px 22px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: var(--rt-radius);
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message.user {
  align-self: flex-end;
  background: var(--rt-accent);
  color: var(--rt-accent-fg);
}

.message.agent {
  align-self: flex-start;
  background: var(--rt-agent-bg);
  color: var(--rt-fg);
}

.thinking {
  align-self: flex-start;
  display: flex;
  gap: 4px;
  padding: 12px;
  visibility: hidden;
}

.thinking.visible {
  visibility: visible;
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
  background: var(--rt-accent-subtle);
  color: var(--rt-accent-ink);
}

.subtasks-badge.completed {
  background: var(--rt-online-subtle);
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
  border-radius: var(--rt-radius-sm);
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
  border-top-color: var(--rt-accent-ink);
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
  border: solid var(--rt-online-fg);
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
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-top: -10px;
  padding: 0 12px 12px;
}

.composer .field {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--rt-border);
  border-radius: var(--rt-radius-sm);
  background: var(--rt-bg);
}

.composer .field:has(textarea:focus) {
  border-color: var(--rt-accent-ink);
}

.composer textarea {
  box-sizing: border-box;
  field-sizing: content;
  min-height: 32px;
  max-height: 112px;
  padding: 8px 12px 4px;
  border: none;
  border-radius: var(--rt-radius-sm);
  font-size: 14px;
  line-height: 20px;
  font-family: inherit;
  color: inherit;
  background: transparent;
  outline: none;
  resize: none;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.composer .field-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px 6px;
  cursor: text;
}

.composer .send {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  flex: none;
  width: 32px;
  height: 32px;
  margin-left: auto;
  padding: 0;
  border: none;
  border-radius: var(--rt-radius-sm);
  background: var(--rt-accent);
  color: var(--rt-accent-fg);
  cursor: pointer;
}

.composer .send:hover {
  background: var(--rt-accent-hover);
}

.composer .send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.composer .start-new {
  flex: 1;
  height: 38px;
  border: none;
  border-radius: var(--rt-radius-sm);
  background: var(--rt-accent);
  color: var(--rt-accent-fg);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.composer .start-new:hover {
  background: var(--rt-accent-hover);
}
`;
