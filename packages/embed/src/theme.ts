export interface ThemeOptions {
  accent?: string;
}

export type ThemeTokens = Record<string, string>;

export const WIDGET_BACKGROUND = "#ffffff";
export const WIDGET_FOREGROUND = "#111827";

const WHITE = "#ffffff";

// WCAG AA minimum for normal text.
const MIN_TEXT_CONTRAST = 4.5;

// How finely the ink search mixes the accent toward the foreground.
const INK_MIX_STEPS = 20;

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
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

function accentInkColor(accent: string): string {
  const accentColor = parseHexColor(accent);
  const foreground = parseHexColor(WIDGET_FOREGROUND);

  for (let step = 0; step <= INK_MIX_STEPS; step++) {
    const amount = step / INK_MIX_STEPS;
    const candidate = formatHexColor(
      mixColors(accentColor, foreground, amount),
    );
    if (contrastRatio(candidate, WIDGET_BACKGROUND) >= MIN_TEXT_CONTRAST) {
      return candidate;
    }
  }

  return WIDGET_FOREGROUND;
}

export function resolveTheme(options: ThemeOptions): ThemeTokens {
  const tokens: ThemeTokens = {};

  if (options.accent !== undefined) {
    const accent = normalizeHexColor(options.accent);
    tokens["--rt-accent"] = accent;
    tokens["--rt-accent-fg"] = accentTextColor(accent);
    tokens["--rt-accent-ink"] = accentInkColor(accent);
  }

  return tokens;
}
