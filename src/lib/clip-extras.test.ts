import { describe, expect, it } from "vitest";
import { addToHistory, isSafeNotifyUrl, looksLikeMarkdown, type HistoryItem } from "./clip-rules";

const item = (code: string, minsLeft: number): HistoryItem => ({
  code, type: "text", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + minsLeft * 60000).toISOString(),
});

describe("history", () => {
  it("keeps only the last 5 sent clips", () => {
    let list: HistoryItem[] = [];
    for (const c of ["A1", "B1", "C1", "D1", "E1", "F1"]) list = addToHistory(list, item(c, 60));
    expect(list.map((i) => i.code)).toEqual(["F1", "E1", "D1", "C1", "B1"]);
  });
  it("drops expired clips", () => {
    expect(addToHistory([item("OLD", -1)], item("NEW", 10)).map((i) => i.code)).toEqual(["NEW"]);
  });
});

describe("markdown detection", () => {
  it("detects #, **, - and code fences", () => {
    expect(looksLikeMarkdown("# Title")).toBe(true);
    expect(looksLikeMarkdown("some **bold** text")).toBe(true);
    expect(looksLikeMarkdown("- item")).toBe(true);
    expect(looksLikeMarkdown("```\ncode\n```")).toBe(true);
    expect(looksLikeMarkdown("just a plain sentence")).toBe(false);
  });
});

describe("notify url", () => {
  it("only allows public https urls", () => {
    expect(isSafeNotifyUrl("https://hooks.example.com/x")).toBe(true);
    expect(isSafeNotifyUrl("http://example.com")).toBe(false);
    expect(isSafeNotifyUrl("https://localhost/x")).toBe(false);
    expect(isSafeNotifyUrl("https://127.0.0.1/x")).toBe(false);
  });
});
