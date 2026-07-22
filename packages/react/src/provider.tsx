import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SdkContext, TokenResponse } from "@realtalk-ai/core";
import { DEFAULT_WS_URL, ValidationError } from "@realtalk-ai/core";

export type { TokenResponse };

export interface RealTalkConfig {
  baseUrl: string;
  tokenUrl: string | null;
  getToken: (() => Promise<TokenResponse>) | null;
  /** @internal */
  context?: SdkContext;
}

const RealTalkContext = createContext<RealTalkConfig | null>(null);

export interface RealTalkProviderProps {
  baseUrl?: string;
  tokenUrl?: string;
  getToken?: () => Promise<TokenResponse>;
  /** @internal Overrides the context reported in sdkInfo. */
  context?: SdkContext;
  children: ReactNode;
}

export function RealTalkProvider({
  baseUrl = DEFAULT_WS_URL,
  tokenUrl,
  getToken,
  context,
  children,
}: RealTalkProviderProps): JSX.Element {
  const value = useMemo(
    () => ({
      baseUrl,
      tokenUrl: tokenUrl ?? null,
      getToken: getToken ?? null,
      context,
    }),
    [baseUrl, tokenUrl, getToken, context],
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
