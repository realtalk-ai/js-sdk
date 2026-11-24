import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ConversationReconnectPolicy,
  DefaultReconnectPolicy,
} from "../src/reconnect.js";

describe("DefaultReconnectPolicy", () => {
  it("returns delays in order", () => {
    const policy = new DefaultReconnectPolicy([100, 200, 500]);

    expect(policy.nextRetryDelayMs({ retryCount: 0, elapsedMs: 0 })).toBe(100);
    expect(policy.nextRetryDelayMs({ retryCount: 1, elapsedMs: 100 })).toBe(
      200,
    );
    expect(policy.nextRetryDelayMs({ retryCount: 2, elapsedMs: 300 })).toBe(
      500,
    );
  });

  it("returns null when retries exhausted", () => {
    const policy = new DefaultReconnectPolicy([100, 200]);

    expect(
      policy.nextRetryDelayMs({ retryCount: 2, elapsedMs: 300 }),
    ).toBeNull();
    expect(
      policy.nextRetryDelayMs({ retryCount: 5, elapsedMs: 1000 }),
    ).toBeNull();
  });

  it("uses default delays when none provided", () => {
    const policy = new DefaultReconnectPolicy();

    expect(policy.nextRetryDelayMs({ retryCount: 0, elapsedMs: 0 })).toBe(300);
    expect(policy.nextRetryDelayMs({ retryCount: 4, elapsedMs: 0 })).toBe(
      10000,
    );
    expect(policy.nextRetryDelayMs({ retryCount: 5, elapsedMs: 0 })).toBeNull();
  });
});

describe("ConversationReconnectPolicy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("waits the planned delays and keeps the last one", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const policy = new ConversationReconnectPolicy([1000, 2000, 5000]);

    const delays = [0, 1, 2, 3, 10].map((retryCount) =>
      policy.nextRetryDelayMs({ retryCount, elapsedMs: 0 }),
    );

    expect(delays).toEqual([1000, 2000, 5000, 5000, 5000]);
  });

  it("waits at least half of the planned delay", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const policy = new ConversationReconnectPolicy([1000]);

    expect(policy.nextRetryDelayMs({ retryCount: 0, elapsedMs: 0 })).toBe(500);
  });

  it("gives up once the time limit has passed", () => {
    const policy = new ConversationReconnectPolicy([1000], 60_000);

    expect(
      policy.nextRetryDelayMs({ retryCount: 3, elapsedMs: 59_999 }),
    ).not.toBeNull();
    expect(
      policy.nextRetryDelayMs({ retryCount: 3, elapsedMs: 60_000 }),
    ).toBeNull();
  });
});
