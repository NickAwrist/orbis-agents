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

  test("includes current date by default when personalization is an empty object", () => {
    const prompt = renderSystemPrompt("{{PERSONALIZATION}}", {
      personalization: {
        now: new Date(2026, 7, 27, 14, 35),
      },
    });

    expect(prompt).toContain("--- User personalization ---");
    expect(prompt).toContain("Current date: Thursday, August 27, 2026");
  });

  test("omits current date when includeCurrentDate is false", () => {
    const prompt = renderSystemPrompt("{{PERSONALIZATION}}", {
      personalization: {
        name: "Nick",
        includeCurrentDate: false,
        now: new Date(2026, 7, 27, 14, 35),
      },
    });

    expect(prompt).toContain("User name: Nick");
    expect(prompt).not.toContain("Current date");
  });

  test("resolves to empty string when all personalization fields are omitted and includeCurrentDate is false", () => {
    const prompt = renderSystemPrompt(
      "Before\n\n{{PERSONALIZATION}}\n\nAfter",
      {
        personalization: {
          includeCurrentDate: false,
        },
      },
    );

    expect(prompt).toBe("Before\n\nAfter");
  });
});
