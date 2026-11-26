import { createContext, useContext, useMemo, type ReactNode } from "react";
import type {
  GetToken,
  ReconnectPolicy,
  TokenResponse,
} from "@realtalk-ai/core";
import { DEFAULT_WS_URL, ValidationError } from "@realtalk-ai/core";

export type { TokenResponse };

export interface RealTalkConfig {
  baseUrl: string;
  tokenUrl: string | null;
  getToken: GetToken | null;
  reconnectPolicy?: ReconnectPolicy | null;
}

const RealTalkContext = createContext<RealTalkConfig | null>(null);

export interface RealTalkProviderProps {
  baseUrl?: string;
  tokenUrl?: string;
  getToken?: GetToken;
  reconnectPolicy?: ReconnectPolicy | null;
  children: ReactNode;
}

export function RealTalkProvider({
  baseUrl = DEFAULT_WS_URL,
  tokenUrl,
  getToken,
  reconnectPolicy,
  children,
}: RealTalkProviderProps): JSX.Element {
  const value = useMemo(
    () => ({
      baseUrl,
      tokenUrl: tokenUrl ?? null,
      getToken: getToken ?? null,
      reconnectPolicy,
    }),
    [baseUrl, tokenUrl, getToken, reconnectPolicy],
  );

  return (
    <RealTalkContext.Provider value={value}>
      {children}
    </RealTalkContext.Provider>
  );
}

export function useRealTalkConfig(): RealTalkConfig {
  const config = useContext(RealTalkContext);
  if (!config) {
    throw new ValidationError(
      "useConversation must be used within RealTalkProvider",
    );
  }
  return config;
}
