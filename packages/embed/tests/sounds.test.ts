import { describe, it, expect } from "vitest";
import { bytesFromDataUrl } from "../src/sounds.js";

describe("bytesFromDataUrl", () => {
  it("decodes the bytes of a base64 data URL", () => {
    const url = `data:audio/mpeg;base64,${btoa("\x00\x7f\xff")}`;

    expect(bytesFromDataUrl(url)).toEqual(new Uint8Array([0, 127, 255]));
  });
});
