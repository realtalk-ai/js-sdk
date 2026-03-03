import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketTransport } from "../src/websocket-transport.js";
import { ConnectionError, ConnectionErrorReason } from "../src/errors.js";
import { DefaultReconnectPolicy } from "../src/reconnect.js";
import { SDK_NAME, SDK_VERSION, SDK_CONTEXT } from "../src/version.js";

const coreSdkInfo = {
  name: SDK_NAME,
  version: SDK_VERSION,
  context: SDK_CONTEXT,
};

// --- Mock WebSocket ---

let mockWs: MockWebSocket;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    mockWs = this;
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({});
  }

  simulateError() {
    this.onerror?.({});
  }

  simulateMessage(data: string) {
    this.onmessage?.({ data });
  }

  simulateClose(code = 1000, reason = "") {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }
}

vi.stubGlobal("WebSocket", MockWebSocket);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// --- Tests ---

describe("WebSocketTransport", () => {
  describe("initial state", () => {
    it("starts as disconnected", () => {
      const transport = new WebSocketTransport();
      expect(transport.status).toBe("disconnected");
    });
  });

  describe("connect", () => {
    it("transitions to connected on successful open", async () => {
      const transport = new WebSocketTransport();
      const statuses: string[] = [];
      transport.onStatusChange((s) => statuses.push(s));

      const p = transport.connect({
        url: "wss://test.com",
        token: "tok",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      expect(transport.status).toBe("connected");
      expect(statuses).toEqual(["connecting", "connected"]);
    });

    it("encodes token in URL", async () => {
      const transport = new WebSocketTransport();
      const p = transport.connect({
        url: "wss://test.com",
        token: "a b&c",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      expect(mockWs.url).toContain("wss://test.com?token=a%20b%26c");
    });

    it("throws ConnectionError on WebSocket error", async () => {
      const transport = new WebSocketTransport();

      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateError();

      await expect(p).rejects.toThrow(ConnectionError);
      expect(transport.status).toBe("disconnected");
    });

    it("throws ConnectionError on timeout", async () => {
      const transport = new WebSocketTransport({ connectionTimeout: 500 });

      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      vi.advanceTimersByTime(501);

      await expect(p).rejects.toThrow(ConnectionError);
      try {
        await p;
      } catch (err) {
        expect((err as ConnectionError).reason).toBe(
          ConnectionErrorReason.Timeout
        );
      }
    });

    it("throws if already connected", async () => {
      const transport = new WebSocketTransport();

      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      await expect(
        transport.connect({
          url: "wss://other.com",
          token: "",
          sdkInfo: coreSdkInfo,
        })
      ).rejects.toThrow("Already connected or connecting");
    });

    it("appends sdkInfo as URL params when provided", async () => {
      const transport = new WebSocketTransport();
      const p = transport.connect({
        url: "wss://test.com",
        token: "tok",
        sdkInfo: { name: "react", version: "1.2.3", context: "web_chat" },
      });
      mockWs.simulateOpen();
      await p;

      expect(mockWs.url).toContain("&context=web_chat");
      expect(mockWs.url).toContain("&sdk_name=react&sdk_version=1.2.3");
    });

    it("always includes sdkInfo params in URL", async () => {
      const transport = new WebSocketTransport();
      const p = transport.connect({
        url: "wss://test.com",
        token: "tok",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      expect(mockWs.url).toContain("&context=core");
      expect(mockWs.url).toContain("&sdk_name=core");
      expect(mockWs.url).toContain(`&sdk_version=${SDK_VERSION}`);
    });

    it("supports AbortSignal (already aborted)", async () => {
      const transport = new WebSocketTransport();
      const controller = new AbortController();
      controller.abort();

      await expect(
        transport.connect({
          url: "wss://test.com",
          token: "",
          sdkInfo: coreSdkInfo,
          signal: controller.signal,
        })
      ).rejects.toThrow(ConnectionError);
    });
  });

  describe("disconnect", () => {
    it("transitions to disconnected and cleans up", async () => {
      const transport = new WebSocketTransport();
      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      transport.disconnect();

      expect(transport.status).toBe("disconnected");
      expect(mockWs.readyState).toBe(MockWebSocket.CLOSED);
      expect(mockWs.onopen).toBeNull();
      expect(mockWs.onerror).toBeNull();
    });
  });

  describe("sendAudio", () => {
    it("sends media message when connected", async () => {
      const transport = new WebSocketTransport();
      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      transport.sendAudio(new Int16Array([1, 2, 3]));

      expect(mockWs.sent).toHaveLength(1);
      const parsed = JSON.parse(mockWs.sent[0]);
      expect(parsed.type).toBe("media");
      expect(parsed.media.payload).toBeTruthy();
    });

    it("drops audio when not connected", () => {
      const transport = new WebSocketTransport();
      transport.sendAudio(new Int16Array([1, 2, 3]));
      // No error thrown, no send
    });
  });

  describe("sendEvent", () => {
    it("sends JSON when connected", async () => {
      const transport = new WebSocketTransport();
      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      transport.sendEvent({ type: "start", agent_id: "a1" });

      expect(mockWs.sent).toHaveLength(1);
      const parsed = JSON.parse(mockWs.sent[0]);
      expect(parsed).toEqual({ type: "start", agent_id: "a1" });
    });

    it("drops events when not connected", () => {
      const transport = new WebSocketTransport();
      transport.sendEvent({ type: "test" });
      // No error thrown
    });
  });

  describe("incoming messages", () => {
    it("emits audio events for media messages", async () => {
      const transport = new WebSocketTransport();
      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      const handler = vi.fn();
      transport.onAudio(handler);

      mockWs.simulateMessage(
        JSON.stringify({
          type: "media",
          media: { payload: btoa("test") },
          trace_id: "tr-1",
        })
      );

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][1]).toBe("tr-1");
    });

    it("emits transport events for non-media messages", async () => {
      const transport = new WebSocketTransport();
      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      const handler = vi.fn();
      transport.onEvent(handler);

      mockWs.simulateMessage(JSON.stringify({ type: "conversation_finished" }));

      expect(handler).toHaveBeenCalledWith({ type: "conversation_finished" });
    });

    it("normalizes message events from BackendMessage to Message shape", async () => {
      const transport = new WebSocketTransport();
      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      const handler = vi.fn();
      transport.onEvent(handler);

      mockWs.simulateMessage(
        JSON.stringify({
          type: "message_created",
          data: {
            id: "msg-1",
            sender: "Agent",
            text: "Hello",
            timestamp: "2025-01-01T00:00:00Z",
          },
        })
      );

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0];
      expect(event.type).toBe("message_created");
      expect(event.data).toEqual({
        id: "msg-1",
        role: "agent",
        text: "Hello",
        createdAt: "2025-01-01T00:00:00Z",
        metadata: undefined,
        hasBeenAnswered: undefined,
        shouldBeAnswered: undefined,
      });
    });

    it("emits error event on invalid JSON", async () => {
      const transport = new WebSocketTransport();
      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      const handler = vi.fn();
      transport.onEvent(handler);

      mockWs.simulateMessage("{not valid json");

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe("error");
      expect(handler.mock.calls[0][0].message).toContain("Failed to parse");
    });
  });

  describe("close handling", () => {
    it("emits close event on WebSocket close", async () => {
      const transport = new WebSocketTransport();
      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      const handler = vi.fn();
      transport.onEvent(handler);

      mockWs.simulateClose(1000, "normal");

      expect(handler).toHaveBeenCalledWith({
        type: "close",
        code: 1000,
        reason: "normal",
      });
    });

    it("transitions to disconnected on normal close (1000)", async () => {
      const transport = new WebSocketTransport();
      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      const statuses: string[] = [];
      transport.onStatusChange((s) => statuses.push(s));

      mockWs.simulateClose(1000);

      expect(transport.status).toBe("disconnected");
    });

    it("transitions to disconnected on abnormal close without reconnect policy", async () => {
      const transport = new WebSocketTransport();
      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      mockWs.simulateClose(1006);

      expect(transport.status).toBe("disconnected");
    });
  });

  describe("reconnection", () => {
    it("attempts reconnection on abnormal close when policy is set", async () => {
      const transport = new WebSocketTransport({
        reconnectPolicy: new DefaultReconnectPolicy([100]),
        connectionTimeout: 1000,
      });

      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      const statuses: string[] = [];
      transport.onStatusChange((s) => statuses.push(s));

      // Simulate abnormal close
      mockWs.simulateClose(1006);
      expect(transport.status).toBe("reconnecting");

      // Advance past reconnect delay
      await vi.advanceTimersByTimeAsync(101);

      // New WebSocket was created, simulate successful open
      mockWs.simulateOpen();

      // Allow microtasks to settle
      await vi.advanceTimersByTimeAsync(0);

      expect(transport.status).toBe("connected");
      expect(statuses).toContain("reconnecting");
      expect(statuses).toContain("connected");
    });

    it("gives up after policy exhausts retries", async () => {
      const transport = new WebSocketTransport({
        reconnectPolicy: new DefaultReconnectPolicy([50]),
        connectionTimeout: 100,
      });

      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      // Simulate abnormal close
      mockWs.simulateClose(1006);
      expect(transport.status).toBe("reconnecting");

      // Advance past reconnect delay
      await vi.advanceTimersByTimeAsync(51);

      // First retry: simulate error
      mockWs.simulateError();

      // Policy has only 1 retry, should now exhaust
      await vi.advanceTimersByTimeAsync(200);

      expect(transport.status).toBe("disconnected");
    });

    it("stops reconnection on intentional disconnect", async () => {
      const transport = new WebSocketTransport({
        reconnectPolicy: new DefaultReconnectPolicy([100, 200]),
      });

      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      mockWs.simulateClose(1006);
      expect(transport.status).toBe("reconnecting");

      transport.disconnect();

      expect(transport.status).toBe("disconnected");

      // Advance timers - should not attempt reconnect
      await vi.advanceTimersByTimeAsync(500);
      expect(transport.status).toBe("disconnected");
    });

    it("does not reconnect on normal close (1000)", async () => {
      const transport = new WebSocketTransport({
        reconnectPolicy: new DefaultReconnectPolicy([100]),
      });

      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      mockWs.simulateClose(1000);

      expect(transport.status).toBe("disconnected");
    });
  });

  describe("removeAllListeners", () => {
    it("removes all registered handlers", async () => {
      const transport = new WebSocketTransport();
      const p = transport.connect({
        url: "wss://test.com",
        token: "",
        sdkInfo: coreSdkInfo,
      });
      mockWs.simulateOpen();
      await p;

      const handler = vi.fn();
      transport.onEvent(handler);
      transport.removeAllListeners();

      mockWs.simulateMessage(JSON.stringify({ type: "conversation_finished" }));

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
