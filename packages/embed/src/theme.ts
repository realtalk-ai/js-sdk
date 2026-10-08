export type Rounding = "small" | "medium" | "large";

export interface ThemeOptions {
  accent?: string;
  rounding?: Rounding;
}

export type ThemeTokens = Record<string, string>;

export const WIDGET_BACKGROUND = "#ffffff";
export const WIDGET_FOREGROUND = "#111827";

const WHITE = "#ffffff";

// WCAG AA minimum for normal text.
const MIN_TEXT_CONTRAST = 4.5;

// Enough contrast for an edge to separate a fill from the background without reading as a border.
const MIN_EDGE_CONTRAST = 1.25;

// How finely the ink and edge searches mix the accent toward the foreground.
const INK_MIX_STEPS = 20;

// The largest channel spread for an accent to still count as grayscale.
const GRAYSCALE_SPREAD = 24;

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

// The panel and message radius, and the smaller one for buttons and fields.
const ROUNDING_TOKENS: Record<Rounding, ThemeTokens> = {
  small: { "--rt-radius": "6px", "--rt-radius-sm": "4px" },
  medium: { "--rt-radius": "12px", "--rt-radius-sm": "8px" },
  large: { "--rt-radius": "20px", "--rt-radius-sm": "12px" },
};

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

export function isRounding(value: string): value is Rounding {
  return Object.keys(ROUNDING_TOKENS).includes(value);
}

function parseHexColor(hex: string): RgbColor {
  const digits = hex.slice(1);
  const fullDigits =
    digits.length === 3
      ? digits
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : digits;

  return {
    red: parseInt(fullDigits.slice(0, 2), 16),
    green: parseInt(fullDigits.slice(2, 4), 16),
    blue: parseInt(fullDigits.slice(4, 6), 16),
  };
}

function formatHexColor(color: RgbColor): string {
  const channels = [color.red, color.green, color.blue].map((value) =>
    Math.round(value).toString(16).padStart(2, "0"),
  );
  return `#${channels.join("")}`;
}

function normalizeHexColor(hex: string): string {
  return formatHexColor(parseHexColor(hex));
}

// sRGB channel to linear light, the first step of WCAG relative luminance.
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
function linearChannel(value: number): number {
  const fraction = value / 255;
  if (fraction <= 0.03928) {
    return fraction / 12.92;
  }
  return ((fraction + 0.055) / 1.055) ** 2.4;
}

// Relative luminance per WCAG 2.1, with the sRGB weights for red, green and blue.
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
function relativeLuminance(color: RgbColor): number {
  return (
    0.2126 * linearChannel(color.red) +
    0.7152 * linearChannel(color.green) +
    0.0722 * linearChannel(color.blue)
  );
}

// Contrast ratio per WCAG 2.1, from 1 to 21. The 0.05 terms model ambient light on the screen.
// https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
export function contrastRatio(firstHex: string, secondHex: string): number {
  const first = relativeLuminance(parseHexColor(firstHex));
  const second = relativeLuminance(parseHexColor(secondHex));
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function mixColors(from: RgbColor, to: RgbColor, amount: number): RgbColor {
  const mixChannel = (start: number, end: number) =>
    start + (end - start) * amount;

  return {
    red: mixChannel(from.red, to.red),
    green: mixChannel(from.green, to.green),
    blue: mixChannel(from.blue, to.blue),
  };
}

function accentTextColor(accent: string): string {
  const whiteContrast = contrastRatio(accent, WHITE);
  const darkContrast = contrastRatio(accent, WIDGET_FOREGROUND);
  return whiteContrast >= darkContrast ? WHITE : WIDGET_FOREGROUND;
}

// The accent mixed toward the foreground until it reaches the given contrast against the
// background. Accents that already pass come back unchanged.
function darkenUntilContrast(accent: string, minContrast: number): string {
  const accentColor = parseHexColor(accent);
  const foreground = parseHexColor(WIDGET_FOREGROUND);

  for (let step = 0; step <= INK_MIX_STEPS; step++) {
    const amount = step / INK_MIX_STEPS;
    const candidate = formatHexColor(
      mixColors(accentColor, foreground, amount),
    );
    if (contrastRatio(candidate, WIDGET_BACKGROUND) >= minContrast) {
      return candidate;
    }
  }

  return WIDGET_FOREGROUND;
}

function accentInkColor(accent: string): string {
  return darkenUntilContrast(accent, MIN_TEXT_CONTRAST);
}

function accentEdgeColor(accent: string): string {
  return darkenUntilContrast(accent, MIN_EDGE_CONTRAST);
}

function isGrayscale(accent: string): boolean {
  const { red, green, blue } = parseHexColor(accent);
  const channels = [red, green, blue];
  return Math.max(...channels) - Math.min(...channels) <= GRAYSCALE_SPREAD;
}

// The color for live states such as voice mode. A grayscale accent has no hue to tint with,
// so those fall back to the online green.
function liveColor(accent: string): string {
  return isGrayscale(accent) ? "var(--rt-online)" : "var(--rt-accent-ink)";
}

export function resolveTheme(options: ThemeOptions): ThemeTokens {
  const tokens: ThemeTokens = {};

  if (options.accent !== undefined) {
    const accent = normalizeHexColor(options.accent);
    tokens["--rt-accent"] = accent;
    tokens["--rt-accent-fg"] = accentTextColor(accent);
    tokens["--rt-accent-ink"] = accentInkColor(accent);
    tokens["--rt-accent-edge"] = accentEdgeColor(accent);
    tokens["--rt-live"] = liveColor(accent);
  }

  if (options.rounding !== undefined) {
    Object.assign(tokens, ROUNDING_TOKENS[options.rounding]);
  }

  return tokens;
}
