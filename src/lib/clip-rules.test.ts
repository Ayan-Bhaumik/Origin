import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  generateCode,
  isAllowedTimer,
  maxExtendedExpiry,
  validateCustomCode,
  validatePin,
  DEFAULT_SETTINGS,
} from "./clip-rules";

describe("clip rules", () => {
  it("auto codes are 6 chars without O, 0, I, L, 1", () => {
    for (const ch of "O0IL1") expect(CODE_ALPHABET).not.toContain(ch);
    const code = generateCode();
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("custom codes must be 4–20 chars of letters, numbers, hyphens", () => {
    expect(validateCustomCode("abc", [])).not.toBeNull();
    expect(validateCustomCode("a".repeat(21), [])).not.toBeNull();
    expect(validateCustomCode("my_code", [])).not.toBeNull();
    expect(validateCustomCode("my-code-1", [])).toBeNull();
  });

  it("blocked codes are rejected case-insensitively", () => {
    expect(validateCustomCode("ADMIN", DEFAULT_SETTINGS.blocked_codes)).not.toBeNull();
    expect(validateCustomCode("system", DEFAULT_SETTINGS.blocked_codes)).not.toBeNull();
  });

  it("PIN must be 4–8 digits", () => {
    expect(validatePin("123")).not.toBeNull();
    expect(validatePin("123456789")).not.toBeNull();
    expect(validatePin("12a4")).not.toBeNull();
    expect(validatePin("1234")).toBeNull();
  });

  it("timers never exceed 24 hours", () => {
    expect(isAllowedTimer(86400, DEFAULT_SETTINGS.allowed_timers)).toBe(true);
    expect(isAllowedTimer(172800, [...DEFAULT_SETTINGS.allowed_timers, 172800])).toBe(false);
    expect(isAllowedTimer(1234, DEFAULT_SETTINGS.allowed_timers)).toBe(false);
  });

  it("default timer is 1 hour", () => {
    expect(DEFAULT_SETTINGS.default_timer_seconds).toBe(3600);
  });

  it("admin extension caps at 24h after creation", () => {
    const created = new Date("2026-01-01T00:00:00Z");
    expect(maxExtendedExpiry(created).toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });
});
