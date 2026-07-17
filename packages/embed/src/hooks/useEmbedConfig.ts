import { useEffect, useState } from "react";
import {
  fetchEmbedConfig,
  type EmbedConfig,
  type EmbedServer,
} from "../session.js";

export function useEmbedConfig(
  server: EmbedServer,
  agentId: string,
): EmbedConfig | null {
  const [config, setConfig] = useState<EmbedConfig | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      try {
        const result = await fetchEmbedConfig(server, agentId);
        if (cancelled) return;
        if (result === null) {
          console.error(
            `[realtalk-embed] Widget not shown: this page's origin is not on the allowlist of agent ${agentId}, or embedding is not enabled for it.`,
          );
          return;
        }
        setConfig(result);
      } catch (error) {
        if (!cancelled) {
          console.error("[realtalk-embed] failed to load config", error);
        }
      }
    };
    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, [server, agentId]);

  return config;
}
