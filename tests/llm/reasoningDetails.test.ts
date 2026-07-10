import { describe, expect, test } from "bun:test";
import {
  compactReasoningDetails,
  stripReasoningFromModelMessages,
} from "../../src/llm/reasoningDetails";

describe("reasoning detail compaction", () => {
  test("joins adjacent streaming fragments into their complete block", () => {
    expect(
      compactReasoningDetails([
        {
          type: "reasoning.summary",
          summary: " get",
          format: "openai-responses-v1",
          index: 0,
        },
        {
          type: "reasoning.summary",
          summary: " the",
          format: "openai-responses-v1",
          index: 0,
        },
        {
          type: "reasoning.summary",
          summary: " current",
          format: "openai-responses-v1",
          index: 0,
        },
      ]),
    ).toEqual([
      {
        type: "reasoning.summary",
        summary: " get the current",
        format: "openai-responses-v1",
        index: 0,
      },
    ]);
  });

  test("keeps distinct blocks separate and strips reasoning from completed turns", () => {
    expect(
      compactReasoningDetails([
        { type: "reasoning.text", text: "One", index: 0 },
        { type: "reasoning.summary", summary: "Summary", index: 1 },
      ]),
    ).toHaveLength(2);

    const messages = stripReasoningFromModelMessages([
      {
        role: "assistant",
        content: "Done",
        reasoning: "private",
        reasoning_details: [{ type: "reasoning.text", text: "One", index: 0 }],
      },
    ]);

    expect(messages).toEqual([{ role: "assistant", content: "Done" }]);
  });
});
