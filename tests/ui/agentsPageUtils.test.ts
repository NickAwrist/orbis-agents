import { describe, expect, test } from "bun:test";
import {
  editorFromAgent,
  reconcileEditorAfterRefresh,
} from "../../ui/components/AgentsPage/agentsPageUtils";
import type { AgentData } from "../../ui/persist/agents";

function agent(overrides: Partial<AgentData> = {}): AgentData {
  return {
    id: "agent-1",
    name: "reviewer",
    description: "Reviews changes.",
    system_prompt: "Review this.",
    is_default: 0,
    tools: ["web_search"],
    skill_ids: ["deleted-skill"],
    delegate_agent_ids: ["deleted-agent"],
    created_at: 1,
    updated_at: 1,
    ...overrides,
  };
}

describe("agent editor refresh", () => {
  test("rehydrates a clean editor from the refreshed agent", () => {
    const baseline = editorFromAgent(agent());
    const refreshed = agent({
      skill_ids: [],
      delegate_agent_ids: [],
      updated_at: 2,
    });

    expect(
      reconcileEditorAfterRefresh(
        baseline,
        baseline,
        refreshed,
        new Set(),
        new Set([refreshed.id]),
      ),
    ).toEqual({
      editor: editorFromAgent(refreshed),
      baseline: editorFromAgent(refreshed),
    });
  });

  test("drops stale IDs without discarding other unsaved edits", () => {
    const baseline = editorFromAgent(agent());
    const editor = {
      ...baseline,
      description: "Unsaved description.",
      skill_ids: ["deleted-skill", "available-skill"],
      delegate_agent_ids: ["deleted-agent", "available-agent"],
    };
    const refreshed = agent({
      skill_ids: [],
      delegate_agent_ids: [],
      updated_at: 2,
    });

    const result = reconcileEditorAfterRefresh(
      editor,
      baseline,
      refreshed,
      new Set(["available-skill"]),
      new Set([refreshed.id, "available-agent"]),
    );

    expect(result.editor).toMatchObject({
      description: "Unsaved description.",
      skill_ids: ["available-skill"],
      delegate_agent_ids: ["available-agent"],
    });
    expect(result.baseline).toEqual(editorFromAgent(refreshed));
  });
});
