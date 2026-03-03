import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "../src/events.js";

type TestEvents = {
  message: [text: string];
  count: [n: number];
  multi: [a: string, b: number];
};

describe("EventEmitter", () => {
  it("calls registered listener on emit", () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.on("message", handler);
    emitter.emit("message", "hello");

    expect(handler).toHaveBeenCalledWith("hello");
  });

  it("supports multiple listeners for the same event", () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.on("message", handler1);
    emitter.on("message", handler2);
    emitter.emit("message", "test");

    expect(handler1).toHaveBeenCalledWith("test");
    expect(handler2).toHaveBeenCalledWith("test");
  });

  it("passes multiple arguments to listeners", () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.on("multi", handler);
    emitter.emit("multi", "hello", 42);

    expect(handler).toHaveBeenCalledWith("hello", 42);
  });

  it("does not call listeners for other events", () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.on("message", handler);
    emitter.emit("count", 5);

    expect(handler).not.toHaveBeenCalled();
  });

  it("removes listener with off()", () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.on("message", handler);
    emitter.off("message", handler);
    emitter.emit("message", "ignored");

    expect(handler).not.toHaveBeenCalled();
  });

  it("once() fires listener exactly once", () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.once("message", handler);
    emitter.emit("message", "first");
    emitter.emit("message", "second");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("first");
  });

  it("off() removes a once() listener before it fires", () => {
    const emitter = new EventEmitter<TestEvents>();
    const handler = vi.fn();

    emitter.once("message", handler);
    emitter.off("message", handler);
    emitter.emit("message", "ignored");

    expect(handler).not.toHaveBeenCalled();
  });

  it("isolates errors in listeners", () => {
    const emitter = new EventEmitter<TestEvents>();
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    emitter.on("message", bad);
    emitter.on("message", good);
    emitter.emit("message", "test");

    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("removeAllListeners() clears all events", () => {
    const emitter = new EventEmitter<TestEvents>();
    const h1 = vi.fn();
    const h2 = vi.fn();

    emitter.on("message", h1);
    emitter.on("count", h2);
    emitter.removeAllListeners();
    emitter.emit("message", "x");
    emitter.emit("count", 1);

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it("removeAllListeners(event) clears only that event", () => {
    const emitter = new EventEmitter<TestEvents>();
    const h1 = vi.fn();
    const h2 = vi.fn();

    emitter.on("message", h1);
    emitter.on("count", h2);
    emitter.removeAllListeners("message");
    emitter.emit("message", "x");
    emitter.emit("count", 1);

    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledWith(1);
  });

  it("emit with no listeners does not throw", () => {
    const emitter = new EventEmitter<TestEvents>();
    expect(() => emitter.emit("message", "test")).not.toThrow();
  });

  it("off with no listeners does not throw", () => {
    const emitter = new EventEmitter<TestEvents>();
    expect(() => emitter.off("message", vi.fn())).not.toThrow();
  });
});
