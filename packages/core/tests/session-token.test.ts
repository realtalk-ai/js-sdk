import { describe, it, expect } from "vitest";
import { sessionTokenExpiresAt } from "../src/session-token.js";

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function tokenWithClaims(claims: Record<string, unknown>): string {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  return `${header}.${base64Url(JSON.stringify(claims))}.signature`;
}

describe("sessionTokenExpiresAt", () => {
  it("returns the expiry of a session token in milliseconds", () => {
    const token = tokenWithClaims({ exp: 1_800_000_000, role: "participant" });

    expect(sessionTokenExpiresAt(token)).toBe(1_800_000_000_000);
  });

  it("reads claims whose encoding uses the URL-safe base64 characters", () => {
    const token = tokenWithClaims({ exp: 1_800_000_000, note: "???>>>" });
    expect(token.split(".")[1]).toMatch(/[-_]/);

    expect(sessionTokenExpiresAt(token)).toBe(1_800_000_000_000);
  });

  it("returns nothing for a token without an expiry", () => {
    expect(
      sessionTokenExpiresAt(tokenWithClaims({ role: "participant" })),
    ).toBe(undefined);
  });

  it("returns nothing for a token that is not a JWT", () => {
    expect(sessionTokenExpiresAt("opaque-token")).toBe(undefined);
    expect(sessionTokenExpiresAt("a.%%%.c")).toBe(undefined);
  });
});
