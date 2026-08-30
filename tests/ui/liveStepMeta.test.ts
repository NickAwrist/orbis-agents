import { describe, expect, test } from "bun:test";
import { getLiveStepMeta } from "../../ui/components/RunArea/liveStepMeta";

const llmStep = {
  kind: "llm_call",
  status: "running",
  agentName: "general_agent",
};

describe("live step metadata", () => {
  test("distinguishes model initialization, reasoning, and response streaming", () => {
    expect(getLiveStepMeta(llmStep, 1, "", "").label).toBe("Initializing");
    expect(getLiveStepMeta(llmStep, 1, "", "Reasoning").label).toBe("Thinking");
    expect(getLiveStepMeta(llmStep, 1, "", " ").label).toBe("Thinking");
    expect(getLiveStepMeta(llmStep, 1, "Answer", "Reasoning").label).toBe(
      "Responding",
    );
  });

  test("identifies delegation from nested run data instead of tool naming", () => {
    const result = getLiveStepMeta(
      {
        kind: "tool_call",
        status: "running",
        toolName: "delegate_to_reviewer_a1b2c3d4",
        childRun: { agentName: "reviewer", steps: [] },
      },
      2,
      "",
      "",
    );

    expect(result.label).toBe("Agent");
  });
});
