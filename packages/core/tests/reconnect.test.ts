import { describe, it, expect } from "vitest";
import { DefaultReconnectPolicy } from "../src/reconnect.js";

describe("DefaultReconnectPolicy", () => {
  it("returns delays in order", () => {
    const policy = new DefaultReconnectPolicy([100, 200, 500]);

    expect(policy.nextRetryDelayMs({ retryCount: 0, elapsedMs: 0 })).toBe(100);
    expect(policy.nextRetryDelayMs({ retryCount: 1, elapsedMs: 100 })).toBe(
      200
    );
    expect(policy.nextRetryDelayMs({ retryCount: 2, elapsedMs: 300 })).toBe(
      500
    );
  });

  it("returns null when retries exhausted", () => {
    const policy = new DefaultReconnectPolicy([100, 200]);

    expect(
      policy.nextRetryDelayMs({ retryCount: 2, elapsedMs: 300 })
    ).toBeNull();
    expect(
      policy.nextRetryDelayMs({ retryCount: 5, elapsedMs: 1000 })
    ).toBeNull();
  });

  it("uses default delays when none provided", () => {
    const policy = new DefaultReconnectPolicy();

    expect(policy.nextRetryDelayMs({ retryCount: 0, elapsedMs: 0 })).toBe(300);
    expect(policy.nextRetryDelayMs({ retryCount: 4, elapsedMs: 0 })).toBe(
      10000
    );
    expect(policy.nextRetryDelayMs({ retryCount: 5, elapsedMs: 0 })).toBeNull();
  });
});
