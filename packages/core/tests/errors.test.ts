import { describe, it, expect } from "vitest";
import {
  RealtalkError,
  ConnectionError,
  ConnectionErrorReason,
  ApiError,
  ProtocolError,
} from "../src/errors.js";

describe("RealtalkError", () => {
  it("extends Error", () => {
    const err = new RealtalkError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RealtalkError);
  });

  it("sets name and message", () => {
    const err = new RealtalkError("something broke");
    expect(err.name).toBe("RealtalkError");
    expect(err.message).toBe("something broke");
  });
});

describe("ConnectionError", () => {
  it("extends RealtalkError", () => {
    const err = new ConnectionError(ConnectionErrorReason.Timeout);
    expect(err).toBeInstanceOf(RealtalkError);
    expect(err).toBeInstanceOf(ConnectionError);
  });

  it("stores the reason", () => {
    const err = new ConnectionError(ConnectionErrorReason.WebSocketFailed);
    expect(err.reason).toBe("websocket_failed");
    expect(err.name).toBe("ConnectionError");
  });

  it("uses default message when none provided", () => {
    const err = new ConnectionError(ConnectionErrorReason.Timeout);
    expect(err.message).toBe("Connection failed: timeout");
  });

  it("uses custom message when provided", () => {
    const err = new ConnectionError(
      ConnectionErrorReason.Timeout,
      "Timed out after 5s"
    );
    expect(err.message).toBe("Timed out after 5s");
  });
});

describe("ApiError", () => {
  it("extends RealtalkError", () => {
    const err = new ApiError(404, "Not found");
    expect(err).toBeInstanceOf(RealtalkError);
    expect(err).toBeInstanceOf(ApiError);
  });

  it("stores statusCode and body", () => {
    const body = { detail: "Not found" };
    const err = new ApiError(404, "Not found", body);
    expect(err.name).toBe("ApiError");
    expect(err.statusCode).toBe(404);
    expect(err.body).toEqual(body);
    expect(err.message).toBe("Not found");
  });

  it("body is optional", () => {
    const err = new ApiError(500, "Server error");
    expect(err.body).toBeUndefined();
  });
});

describe("ProtocolError", () => {
  it("extends RealtalkError", () => {
    const err = new ProtocolError("bad parse");
    expect(err).toBeInstanceOf(RealtalkError);
    expect(err).toBeInstanceOf(ProtocolError);
  });

  it("stores rawData", () => {
    const err = new ProtocolError("parse failed", "{invalid json");
    expect(err.name).toBe("ProtocolError");
    expect(err.rawData).toBe("{invalid json");
    expect(err.message).toBe("parse failed");
  });

  it("rawData is optional", () => {
    const err = new ProtocolError("unknown");
    expect(err.rawData).toBeUndefined();
  });
});
