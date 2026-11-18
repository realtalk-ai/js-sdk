import { describe, it, expect, vi, afterEach } from "vitest";
import { warnDeprecated } from "../src/deprecations.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("warnDeprecated", () => {
  it("warns once per name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    warnDeprecated("first", "first is going away");
    warnDeprecated("first", "first is going away");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "[realtalk] deprecated: first is going away",
    );
  });

  it("warns for each name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    warnDeprecated("second", "second is going away");
    warnDeprecated("third", "third is going away");

    expect(warn).toHaveBeenCalledTimes(2);
  });
});
