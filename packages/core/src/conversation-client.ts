import type {
  AgentState,
  AnnotationItem,
  AudioSource,
  ClientEvent,
  ConnectionStatus,
  ConversationError,
  ConversationEvent,
  ConversationMode,
  ConversationStatus,
  DTMFDigit,
  Message,
  SessionToken,
  TimelineItem,
  TokenResponse,
  UserState,
} from "./types.js";
import { EventType } from "./types.js";
import type { AudioTransport, SdkInfo } from "./transport.js";
import {
  PAUSED_CLOSE_CODES,
  RECONNECTABLE_CLOSE_CODES,
  WebSocketTransport,
} from "./websocket-transport.js";
import {
  ApiError,
  ConnectionError,
  ProtocolError,
  ValidationError,
} from "./errors.js";
import { sessionTokenExpiresAt } from "./session-token.js";
import {
  ConversationReconnectPolicy,
  type ReconnectPolicy,
} from "./reconnect.js";
import { DEFAULT_WS_URL } from "./constants.js";
import { SDK_NAME, SDK_VERSION } from "./version.js";
import { buildTimeline } from "./events.js";
import {
  applyMessageEvent,
  EMPTY_MESSAGE_STATE,
  type MessageState,
} from "./message-state.js";

const MIN_TOKEN_LIFETIME_LEFT_MS = 60 * 1000;

const DEFAULT_SDK_INFO: SdkInfo = {
  name: SDK_NAME,
  version: SDK_VERSION,
  context: "web_chat",
};

export const DEFAULT_CONVERSATION_MODE: ConversationMode = {
  userAudio: false,
  agentAudio: false,
};

const MESSAGE_EVENT_TYPES: ReadonlySet<string> = new Set([
  EventType.ExistingMessages,
  EventType.MessageCreated,
  EventType.MessageUpdated,
  EventType.AnnotationCreated,
  EventType.Vad,
]);

export interface StartConversationOptions {
  agentId: string;
  conversationId?: string;
  mode?: ConversationMode;
  token?: string;
  getToken?: () => Promise<TokenResponse>;
}

export interface ConversationClientCallbacks {
  onEvent?: (event: ConversationEvent) => void;
  onMessage?: (message: Message) => void;
  onAnnotation?: (item: AnnotationItem) => void;
  onError?: (error: ConversationError) => void;
  onStatusChange?: (status: ConversationStatus) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onModeRefused?: (
    requestedMode: ConversationMode,
    currentMode: ConversationMode,
  ) => void;
  onAudio?: (pcm: Int16Array, traceId: string, source: AudioSource) => void;
  onClear?: () => void;
  onCleanup?: () => void;
}

export interface ConversationClientOptions {
  baseUrl?: string;
  sdkInfo?: SdkInfo;
  tokenUrl?: string | null;
  getToken?: (() => Promise<TokenResponse>) | null;
  reconnectPolicy?: ReconnectPolicy;
  createTransport?: () => AudioTransport;
  callbacks?: ConversationClientCallbacks;
}

export interface ConversationState {
  connectionStatus: ConnectionStatus;
  status: ConversationStatus;
  conversationId: string | null;
  error: ConversationError | null;
  mode: ConversationMode;
  messages: Message[];
  annotations: AnnotationItem[];
  timeline: TimelineItem[];
  userState: UserState;
  agentState: AgentState;
}

interface FetchedToken {
  token: string;
  conversationId?: string;
}

type TokenRenewal = "renewed" | "stopped" | "failed";

function isSameMode(a: ConversationMode, b: ConversationMode): boolean {
  return a.userAudio === b.userAudio && a.agentAudio === b.agentAudio;
}

function tokenWasRefused(error: unknown): error is ApiError {
  if (!(error instanceof ApiError)) return false;
  const isClientError = error.statusCode >= 400 && error.statusCode < 500;
  const isRateLimited = error.statusCode === 429;
  return isClientError && !isRateLimited;
}

function canReuseToken(
  token: string | null,
  failedToConnect: boolean,
): boolean {
  if (!token || failedToConnect) return false;
  const expiresAt = sessionTokenExpiresAt(token);
  if (expiresAt === undefined) return false;
  return expiresAt - Date.now() > MIN_TOKEN_LIFETIME_LEFT_MS;
}

export class ConversationClient {
  private options: ConversationClientOptions;
  private messageState: MessageState = EMPTY_MESSAGE_STATE;
  private state: ConversationState = {
    connectionStatus: "disconnected",
    status: "not_started",
    conversationId: null,
    error: null,
    mode: DEFAULT_CONVERSATION_MODE,
    messages: [],
    annotations: [],
    timeline: [],
    userState: "idle",
    agentState: "idle",
  };
  private readonly listeners = new Set<() => void>();
  private transport: AudioTransport | null = null;
  private sessionOptions: StartConversationOptions | null = null;
  private sessionToken: string | null = null;
  private requestedMode: ConversationMode | null = null;
  private reconnectAttempt = 0;
  private reconnectStartedAt: number | null = null;
  private tokenFailedToConnect = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;

  constructor(options: ConversationClientOptions) {
    this.options = options;
  }

  configure(options: Partial<ConversationClientOptions>): void {
    this.options = { ...this.options, ...options };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): ConversationState => this.state;

  getMode = (): ConversationMode => this.state.mode;

  async start(sessionOptions: StartConversationOptions): Promise<string> {
    this.update({ error: null });

    if (this.state.status === "active") {
      throw new ValidationError("Conversation already active");
    }
    if (!sessionOptions.agentId) {
      throw new ValidationError("agentId is required");
    }

    const resolvedOptions = { ...sessionOptions };
    this.intentionalDisconnect = false;
    this.sessionOptions = resolvedOptions;
    this.requestedMode = null;
    this.setMode(sessionOptions.mode ?? DEFAULT_CONVERSATION_MODE);
    this.clearMessages();

    const tokenConversationId = await this.resolveToken(sessionOptions);

    this.setConnectionStatus("connecting");
    this.setStatus("active");

    const id = sessionOptions.conversationId ?? tokenConversationId;
    if (!id) {
      throw new ValidationError(
        "No conversation ID available. Pass a conversationId when starting or use a token endpoint that returns conversation_id.",
      );
    }
    this.update({ conversationId: id });

    try {
      await this.connect(resolvedOptions);
    } catch (error) {
      this.cleanup();
      this.setConnectionStatus("disconnected");
      this.setStatus("not_started");
      throw error;
    }

    return id;
  }

  async end(): Promise<void> {
    const { status, conversationId } = this.state;
    const wasRunning = status === "active" || status === "paused";
    const transport = this.transport;
    if (transport) {
      transport.sendEvent({ type: "end_conversation", data: {} });
      transport.removeAllListeners();
      await transport.gracefulDisconnect();
      this.transport = null;
    }
    this.intentionalDisconnect = true;
    this.update({ error: null });
    this.cleanup();
    this.setStatus(wasRunning ? "finished" : "not_started");
    this.setConnectionStatus("disconnected");
    if (wasRunning && conversationId) {
      this.update({ conversationId });
    }
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.cleanup();
    this.update({ status: "not_started", connectionStatus: "disconnected" });
  }

  sendMessage(text: string): void {
    this.transport?.sendEvent({ type: "message", data: text });
  }

  sendDTMF(digit: DTMFDigit): void {
    this.transport?.sendEvent({ type: "dtmf", data: digit });
  }

  sendEvent(payload: ClientEvent): void {
    this.transport?.sendEvent(payload);
  }

  sendAudio(pcm: Int16Array): void {
    this.transport?.sendAudio(pcm);
  }

  requestMode(mode: ConversationMode): void {
    if (!this.transport) return;
    this.requestedMode = mode;
    this.transport.sendEvent({
      type: "set_conversation_mode",
      data: { user_audio: mode.userAudio, agent_audio: mode.agentAudio },
    });
  }

  clearMessages(): void {
    this.setMessageState({
      ...this.messageState,
      messages: [],
      annotations: [],
    });
  }

  private get callbacks(): ConversationClientCallbacks {
    return this.options.callbacks ?? {};
  }

  private update(changes: Partial<ConversationState>): void {
    const next = { ...this.state, ...changes };
    const hasThinkingMessage = this.messageState.thinkingMessageId !== null;
    const isThinking = hasThinkingMessage && next.status !== "finished";
    next.agentState = isThinking ? "thinking" : "idle";
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  private setMessageState(state: MessageState): void {
    const listsChanged =
      state.messages !== this.messageState.messages ||
      state.annotations !== this.messageState.annotations;
    const timeline = listsChanged
      ? buildTimeline(state.messages, state.annotations)
      : this.state.timeline;
    this.messageState = state;
    this.update({
      messages: state.messages,
      annotations: state.annotations,
      userState: state.userState,
      timeline,
    });
  }

  private setStatus(status: ConversationStatus): void {
    this.update({ status });
    this.callbacks.onStatusChange?.(status);
  }

  private setConnectionStatus(connectionStatus: ConnectionStatus): void {
    this.update({ connectionStatus });
    this.callbacks.onConnectionStatusChange?.(connectionStatus);
  }

  private setMode(mode: ConversationMode): void {
    if (isSameMode(this.state.mode, mode)) return;
    this.update({ mode });
  }

  private reportError(error: Error, fatal: boolean): void {
    const conversationError: ConversationError = {
      error,
      fatal,
      timestamp: Date.now(),
    };
    this.update({ error: conversationError });
    this.callbacks.onError?.(conversationError);
  }

  private cleanup(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.callbacks.onCleanup?.();

    if (this.transport) {
      this.transport.removeAllListeners();
      this.transport.disconnect();
      this.transport = null;
    }

    this.update({ conversationId: null });
    this.sessionOptions = null;
    this.sessionToken = null;
    this.reconnectAttempt = 0;
    this.reconnectStartedAt = null;
    this.tokenFailedToConnect = false;
  }

  private handleEvent(event: ConversationEvent): void {
    this.callbacks.onEvent?.(event);

    if (MESSAGE_EVENT_TYPES.has(event.type)) {
      this.handleMessageEvent(event);
      return;
    }

    switch (event.type) {
      case EventType.Clear:
        this.callbacks.onClear?.();
        break;
      case EventType.ConversationMode:
        this.handleConfirmedMode({
          userAudio: event.data.user_audio,
          agentAudio: event.data.agent_audio,
        });
        break;
      case EventType.ConversationStatus:
        if (event.data.status === "ended") this.finish();
        break;
      case EventType.Close:
        this.handleClose(event.code);
        break;
      case EventType.Error:
        this.reportError(
          new ProtocolError(event.message ?? "Unknown error"),
          false,
        );
        break;
    }
  }

  private handleMessageEvent(event: ConversationEvent): void {
    const change = applyMessageEvent(this.messageState, event);
    this.setMessageState(change.state);
    if (change.message) this.callbacks.onMessage?.(change.message);
    if (change.annotation) this.callbacks.onAnnotation?.(change.annotation);
  }

  private handleConfirmedMode(confirmedMode: ConversationMode): void {
    const requestedMode = this.requestedMode;
    this.requestedMode = null;
    this.setMode(confirmedMode);

    const wasRefused =
      requestedMode !== null && !isSameMode(requestedMode, this.state.mode);
    if (!wasRefused) return;

    this.reportError(
      new ProtocolError(
        "The requested conversation mode is not available right now",
      ),
      false,
    );
    this.callbacks.onModeRefused?.(requestedMode, this.state.mode);
  }

  private finish(): void {
    const finishedId = this.state.conversationId;
    this.intentionalDisconnect = true;
    this.cleanup();
    this.setStatus("finished");
    this.setConnectionStatus("disconnected");
    if (finishedId) this.update({ conversationId: finishedId });
  }

  private handleClose(code: number): void {
    const isUnexpected = !this.intentionalDisconnect && this.sessionOptions;
    if (!isUnexpected) return;

    if (PAUSED_CLOSE_CODES.has(code)) {
      const pausedId = this.state.conversationId;
      this.cleanup();
      this.setStatus("paused");
      this.setConnectionStatus("disconnected");
      if (pausedId) this.update({ conversationId: pausedId });
      return;
    }

    if (RECONNECTABLE_CLOSE_CODES.has(code)) {
      this.setConnectionStatus("reconnecting");
      this.scheduleReconnect();
      return;
    }

    this.reportError(
      new ConnectionError(
        "websocket_failed",
        `Connection closed with code ${code}`,
      ),
      true,
    );
    this.cleanup();
    this.setStatus("not_started");
    this.setConnectionStatus("disconnected");
  }

  private async connect(
    sessionOptions: StartConversationOptions,
  ): Promise<void> {
    this.setConnectionStatus("connecting");

    const id = this.state.conversationId;
    if (!id) {
      throw new ValidationError("No conversation ID available for connection");
    }

    const createTransport =
      this.options.createTransport ?? (() => new WebSocketTransport());
    const transport = createTransport();
    this.transport = transport;
    transport.onAudio((pcm, traceId, source) =>
      this.callbacks.onAudio?.(pcm, traceId, source),
    );
    transport.onEvent((event) => this.handleEvent(event));

    await transport.connect({
      url: `${this.options.baseUrl ?? DEFAULT_WS_URL}/ws/conversations/audio/${id}/`,
      token: this.sessionToken ?? "",
      sdkInfo: this.options.sdkInfo ?? DEFAULT_SDK_INFO,
      mode: this.state.mode,
      protocol: 2,
    });

    this.reconnectAttempt = 0;
    this.reconnectStartedAt = null;
    this.tokenFailedToConnect = false;
    this.update({ error: null });
    this.setConnectionStatus("connected");

    transport.sendEvent({ type: "start", agent_id: sessionOptions.agentId });
  }

  private async fetchToken(
    sessionOptions: StartConversationOptions,
  ): Promise<FetchedToken | null> {
    const tokenSource = sessionOptions.getToken ?? this.options.getToken;
    if (tokenSource) {
      const tokenResult = await tokenSource();
      return typeof tokenResult === "string"
        ? { token: tokenResult }
        : tokenResult;
    }

    const { tokenUrl } = this.options;
    if (!tokenUrl) return null;
    const response = await fetch(tokenUrl);
    if (!response.ok) {
      throw new ApiError(
        response.status,
        `Failed to fetch session token: ${response.status}`,
      );
    }
    const data = (await response.json()) as SessionToken;
    return {
      token: data.token,
      conversationId: data.conversation_id || undefined,
    };
  }

  private async resolveToken(
    sessionOptions: StartConversationOptions,
  ): Promise<string | undefined> {
    if (sessionOptions.token) {
      this.sessionToken = sessionOptions.token;
      return undefined;
    }

    const fetched = await this.fetchToken(sessionOptions);
    if (!fetched) return undefined;
    this.sessionToken = fetched.token;
    return fetched.conversationId;
  }

  private stopReconnecting(error: Error): void {
    this.reportError(error, true);
    this.cleanup();
    this.setStatus("not_started");
    this.setConnectionStatus("disconnected");
  }

  private isNoLongerReconnecting(
    sessionOptions: StartConversationOptions,
  ): boolean {
    return this.intentionalDisconnect || this.sessionOptions !== sessionOptions;
  }

  private async renewToken(
    sessionOptions: StartConversationOptions,
  ): Promise<TokenRenewal> {
    let fetched: FetchedToken | null;
    try {
      fetched = await this.fetchToken(sessionOptions);
    } catch (error) {
      if (this.isNoLongerReconnecting(sessionOptions)) return "stopped";
      if (!tokenWasRefused(error)) return "failed";
      this.stopReconnecting(error);
      return "stopped";
    }
    if (this.isNoLongerReconnecting(sessionOptions)) return "stopped";

    const isForAnotherConversation =
      fetched?.conversationId !== undefined &&
      fetched.conversationId !== this.state.conversationId;
    if (isForAnotherConversation) {
      this.stopReconnecting(
        new ConnectionError(
          "websocket_failed",
          "The refreshed session token is for another conversation",
        ),
      );
      return "stopped";
    }

    if (fetched) {
      this.sessionToken = fetched.token;
      this.tokenFailedToConnect = false;
    }
    return "renewed";
  }

  private scheduleReconnect(): void {
    if (this.intentionalDisconnect) return;

    this.reconnectStartedAt ??= Date.now();
    const policy =
      this.options.reconnectPolicy ?? new ConversationReconnectPolicy();
    const delay = policy.nextRetryDelayMs({
      retryCount: this.reconnectAttempt,
      elapsedMs: Date.now() - this.reconnectStartedAt,
    });
    if (delay === null) {
      this.stopReconnecting(
        new ConnectionError(
          "websocket_failed",
          "All reconnection attempts exhausted",
        ),
      );
      return;
    }

    this.reconnectTimeout = setTimeout(() => void this.reconnect(), delay);
  }

  private async reconnect(): Promise<void> {
    const sessionOptions = this.sessionOptions;
    if (this.intentionalDisconnect || !sessionOptions) return;

    this.reconnectAttempt++;

    const reusesToken = canReuseToken(
      this.sessionToken,
      this.tokenFailedToConnect,
    );
    const renewal = reusesToken
      ? "renewed"
      : await this.renewToken(sessionOptions);
    if (renewal === "stopped") return;
    if (renewal === "failed") {
      this.scheduleReconnect();
      return;
    }

    try {
      await this.connect(sessionOptions);
    } catch {
      if (this.isNoLongerReconnecting(sessionOptions)) return;
      this.tokenFailedToConnect = true;
      this.setConnectionStatus("reconnecting");
      this.scheduleReconnect();
    }
  }
}
