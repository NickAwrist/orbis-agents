import { describe, expect, test } from "bun:test";
import { renderSystemPrompt } from "../../src/prompts/render";

describe("system prompt rendering", () => {
  test("includes the current date without a cache-busting time", () => {
    const prompt = renderSystemPrompt("{{PERSONALIZATION}}", {
      personalization: {
        name: "Nick",
        now: new Date(2026, 7, 27, 14, 35),
      },
    });

    expect(prompt).toContain("Current date: Thursday, August 27, 2026");
    expect(prompt).not.toContain("2:35");
    expect(prompt).not.toContain("date and time");
  });
});
