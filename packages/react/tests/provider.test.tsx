import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { RealTalkProvider, useRealTalkConfig } from "../src/provider.js";

function wrapper(props: Record<string, unknown> = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <RealTalkProvider {...props}>{children}</RealTalkProvider>;
  };
}

describe("RealTalkProvider", () => {
  it("useRealTalkConfig returns config with defaults when no props", () => {
    const { result } = renderHook(() => useRealTalkConfig(), {
      wrapper: wrapper(),
    });

    expect(result.current.baseUrl).toBe("wss://api.realtalk.ml/api/v1");
    expect(result.current.tokenUrl).toBeNull();
    expect(result.current.getToken).toBeNull();
  });

  it("useRealTalkConfig returns custom baseUrl when provided", () => {
    const { result } = renderHook(() => useRealTalkConfig(), {
      wrapper: wrapper({
        baseUrl: "wss://custom.example.com",
      }),
    });

    expect(result.current.baseUrl).toBe("wss://custom.example.com");
  });

  it("useRealTalkConfig throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useRealTalkConfig());
    }).toThrow("useConversation must be used within RealTalkProvider");
  });

  it("tokenUrl passed through", () => {
    const { result } = renderHook(() => useRealTalkConfig(), {
      wrapper: wrapper({ tokenUrl: "https://example.com/token" }),
    });

    expect(result.current.tokenUrl).toBe("https://example.com/token");
  });

  it("getToken callback passed through", () => {
    const getToken = async () => "test-token";
    const { result } = renderHook(() => useRealTalkConfig(), {
      wrapper: wrapper({ getToken }),
    });

    expect(result.current.getToken).toBe(getToken);
  });
});
