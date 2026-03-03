import { describe, it, expect } from "vitest";
import { pcmToBase64, base64ToPcm } from "../src/audio.js";

describe("pcmToBase64 / base64ToPcm", () => {
  it("roundtrips a small buffer", () => {
    const original = new Int16Array([0, 100, -100, 32767, -32768]);
    const encoded = pcmToBase64(original);
    const decoded = base64ToPcm(encoded);

    expect(decoded).toEqual(original);
  });

  it("roundtrips an empty buffer", () => {
    const original = new Int16Array([]);
    const encoded = pcmToBase64(original);
    const decoded = base64ToPcm(encoded);

    expect(decoded).toEqual(original);
  });

  it("roundtrips a buffer larger than chunk size", () => {
    const size = 10000;
    const original = new Int16Array(size);
    for (let i = 0; i < size; i++) {
      original[i] = ((i * 7) % 65536) - 32768;
    }

    const encoded = pcmToBase64(original);
    const decoded = base64ToPcm(encoded);

    expect(decoded).toEqual(original);
  });

  it("produces valid base64 string", () => {
    const data = new Int16Array([1, 2, 3]);
    const encoded = pcmToBase64(data);

    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);
    expect(() => atob(encoded)).not.toThrow();
  });
});
