import { describe, it, expect } from "vitest";
import {
  WIDGET_BACKGROUND,
  WIDGET_FOREGROUND,
  contrastRatio,
  isHexColor,
  resolveTheme,
} from "../src/theme.js";

describe("isHexColor", () => {
  it("accepts short and long hex in any case", () => {
    expect(isHexColor("#fff")).toBe(true);
    expect(isHexColor("#1D4ED8")).toBe(true);
    expect(isHexColor("#facc15")).toBe(true);
  });

  it("rejects other color formats", () => {
    expect(isHexColor("red")).toBe(false);
    expect(isHexColor("#12345")).toBe(false);
    expect(isHexColor("rgb(0,0,0)")).toBe(false);
    expect(isHexColor("1d4ed8")).toBe(false);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#1d4ed8", "#facc15")).toBeCloseTo(
      contrastRatio("#facc15", "#1d4ed8"),
    );
  });
});

describe("resolveTheme", () => {
  it("returns no tokens without options", () => {
    expect(resolveTheme({})).toEqual({});
  });

  it("normalizes the accent to long lowercase hex", () => {
    expect(resolveTheme({ accent: "#ABC" })["--rt-accent"]).toBe("#aabbcc");
  });

  it("picks white text on dark accents", () => {
    for (const accent of ["#000000", "#1e3a8a", "#2563eb"]) {
      expect(resolveTheme({ accent })["--rt-accent-fg"]).toBe("#ffffff");
    }
  });

  it("picks the dark foreground on light accents", () => {
    for (const accent of ["#ffffff", "#facc15"]) {
      expect(resolveTheme({ accent })["--rt-accent-fg"]).toBe(
        WIDGET_FOREGROUND,
      );
    }
  });

  it("keeps dark accents as their own ink", () => {
    for (const accent of ["#000000", "#2563eb"]) {
      expect(resolveTheme({ accent })["--rt-accent-ink"]).toBe(accent);
    }
  });

  it("darkens a light accent until it is readable on the background", () => {
    const ink = resolveTheme({ accent: "#facc15" })["--rt-accent-ink"];

    expect(ink).not.toBe("#facc15");
    expect(contrastRatio(ink, WIDGET_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink, "#facc15")).toBeLessThan(
      contrastRatio(WIDGET_FOREGROUND, "#facc15"),
    );
  });

  it("gives a white accent a readable gray ink", () => {
    const ink = resolveTheme({ accent: "#ffffff" })["--rt-accent-ink"];

    expect(contrastRatio(ink, WIDGET_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink, WIDGET_BACKGROUND)).toBeLessThan(
      contrastRatio(WIDGET_FOREGROUND, WIDGET_BACKGROUND),
    );
  });
});
