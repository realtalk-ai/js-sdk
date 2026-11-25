import { useEffect, useState } from "react";
import { ConversationReconnectPolicy } from "@realtalk-ai/core";
import {
  fetchEmbedConfig,
  type EmbedConfig,
  type EmbedServer,
} from "../session.js";
import { wait } from "../wait.js";

export function useEmbedConfig(
  server: EmbedServer,
  agentId: string,
): EmbedConfig | null {
  const [config, setConfig] = useState<EmbedConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loading = false;
    let settled = false;

    const loadConfig = async () => {
      if (loading || settled) return;
      loading = true;
      const retryPolicy = new ConversationReconnectPolicy();
      const startedAt = Date.now();
      try {
        for (let retryCount = 0; ; retryCount++) {
          try {
            const result = await fetchEmbedConfig(server, agentId);
            if (cancelled) return;
            settled = true;
            if (result === null) {
              console.error(
                `[realtalk-embed] Widget not shown: this page's origin is not on the allowlist of agent ${agentId}, or embedding is not enabled for it.`,
              );
              return;
            }
            setConfig(result);
            return;
          } catch (error) {
            if (cancelled) return;
            const retryDelay = retryPolicy.nextRetryDelayMs({
              retryCount,
              elapsedMs: Date.now() - startedAt,
            });
            if (retryDelay === null) {
              console.error("[realtalk-embed] failed to load config", error);
              return;
            }
            await wait(retryDelay);
            if (cancelled) return;
          }
        }
      } finally {
        loading = false;
      }
    };
    const loadWhenVisible = () => {
      if (document.visibilityState === "visible") void loadConfig();
    };

    void loadConfig();
    window.addEventListener("online", loadConfig);
    document.addEventListener("visibilitychange", loadWhenVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("online", loadConfig);
      document.removeEventListener("visibilitychange", loadWhenVisible);
    };
  }, [server, agentId]);

  return config;
}
