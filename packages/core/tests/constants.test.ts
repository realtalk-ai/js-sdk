import { describe, it, expect } from "vitest";
import { DEFAULT_WS_URL } from "../src/constants.js";

describe("constants", () => {
  it("exports DEFAULT_WS_URL", () => {
    expect(DEFAULT_WS_URL).toBe("wss://api.realtalk.ml/api/v1");
  });
});
