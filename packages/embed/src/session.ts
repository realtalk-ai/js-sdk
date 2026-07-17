import { ApiError, type TokenResponse } from "@realtalk-ai/core";

export const DEFAULT_SERVER_URL = "https://api.realtalk.ml";

export interface EmbedServer {
  apiBaseUrl: string;
  wsBaseUrl: string;
}

export interface EmbedConfig {
  displayName: string;
  greeting: string;
  idlePauseSeconds: number;
  idleEndSeconds: number;
}

export interface SessionMinter {
  getToken: () => Promise<TokenResponse>;
  reset: () => void;
  readonly conversationId: string | undefined;
}

function conversationStorageKey(agentId: string): string {
  return `realtalk-embed:conversation:${agentId}`;
}

function readStoredConversationId(agentId: string): string | undefined {
  try {
    return sessionStorage.getItem(conversationStorageKey(agentId)) ?? undefined;
  } catch {
    return undefined;
  }
}

function storeConversationId(agentId: string, conversationId: string): void {
  try {
    sessionStorage.setItem(conversationStorageKey(agentId), conversationId);
  } catch {}
}

function clearStoredConversationId(agentId: string): void {
  try {
    sessionStorage.removeItem(conversationStorageKey(agentId));
  } catch {}
}

export function resolveServer(serverUrl: string): EmbedServer {
  const url = new URL(serverUrl);
  const wsProtocol = url.protocol === "http:" ? "ws:" : "wss:";
  const base = `${url.host}${url.pathname.replace(/\/$/, "")}/api/v1`;

  return {
    apiBaseUrl: `${url.protocol}//${base}`,
    wsBaseUrl: `${wsProtocol}//${base}`,
  };
}

export async function fetchEmbedConfig(
  server: EmbedServer,
  agentId: string,
): Promise<EmbedConfig | null> {
  const response = await fetch(
    `${server.apiBaseUrl}/embed-configs/${agentId}/`,
  );
  if (response.status === 403 || response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Failed to fetch embed config: ${response.status}`,
    );
  }
  const data = (await response.json()) as {
    display_name: string;
    greeting: string;
    idle_pause_seconds: number;
    idle_end_seconds: number;
  };
  return {
    displayName: data.display_name,
    greeting: data.greeting,
    idlePauseSeconds: data.idle_pause_seconds,
    idleEndSeconds: data.idle_end_seconds,
  };
}

export function createSessionMinter(
  server: EmbedServer,
  agentId: string,
): SessionMinter {
  let conversationId = readStoredConversationId(agentId);

  const mint = (conversationIdToResume: string | undefined) =>
    fetch(`${server.apiBaseUrl}/embed-sessions/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: agentId,
        ...(conversationIdToResume && {
          conversation_id: conversationIdToResume,
        }),
      }),
    });

  return {
    get conversationId() {
      return conversationId;
    },

    async getToken() {
      let response = await mint(conversationId);

      const resumeRejected = !response.ok && conversationId !== undefined;
      if (resumeRejected) {
        conversationId = undefined;
        clearStoredConversationId(agentId);
        response = await mint(undefined);
      }

      if (!response.ok) {
        throw new ApiError(
          response.status,
          `Failed to mint embed session: ${response.status}`,
        );
      }

      const data = (await response.json()) as {
        token: string;
        conversation_id: string;
      };
      conversationId = data.conversation_id;
      storeConversationId(agentId, data.conversation_id);

      return { token: data.token, conversationId: data.conversation_id };
    },

    reset() {
      conversationId = undefined;
      clearStoredConversationId(agentId);
    },
  };
}
