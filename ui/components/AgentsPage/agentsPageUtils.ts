import type { AgentData } from "../../persist/agents";
import type { AgentEditorState } from "./types";

export const PROTECTED_AGENT_NAME = "general_agent";

export function canDeleteAgent(a: AgentData): boolean {
  return a.name !== PROTECTED_AGENT_NAME;
}

export function emptyEditor(): AgentEditorState {
  return {
    name: "",
    description: "",
    system_prompt: "",
    tools: [],
    skill_ids: [],
    delegate_agent_ids: [],
  };
}

export function editorFromAgent(a: AgentData): AgentEditorState {
  return {
    name: a.name,
    description: a.description,
    system_prompt: a.system_prompt,
    tools: [...a.tools],
    skill_ids: [...(a.skill_ids ?? [])],
    delegate_agent_ids: [...(a.delegate_agent_ids ?? [])],
  };
}

export function removeUnavailableCapabilityIds(
  editor: AgentEditorState,
  availableSkillIds: ReadonlySet<string>,
  availableAgentIds: ReadonlySet<string>,
): AgentEditorState {
  return {
    ...editor,
    skill_ids: editor.skill_ids.filter((id) => availableSkillIds.has(id)),
    delegate_agent_ids: editor.delegate_agent_ids.filter((id) =>
      availableAgentIds.has(id),
    ),
  };
}

export function reconcileEditorAfterRefresh(
  editor: AgentEditorState,
  baseline: AgentEditorState,
  refreshedAgent: AgentData,
  availableSkillIds: ReadonlySet<string>,
  availableAgentIds: ReadonlySet<string>,
): { editor: AgentEditorState; baseline: AgentEditorState } {
  const refreshedBaseline = editorFromAgent(refreshedAgent);
  if (editorsEqual(editor, baseline)) {
    return { editor: refreshedBaseline, baseline: refreshedBaseline };
  }
  return {
    editor: removeUnavailableCapabilityIds(
      editor,
      availableSkillIds,
      availableAgentIds,
    ),
    baseline: refreshedBaseline,
  };
}

function arraysEqual(a: string[], b: string[]): boolean {
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return (
    sortedA.length === sortedB.length &&
    sortedA.every((value, index) => value === sortedB[index])
  );
}

/** Stable compare; selection order does not affect equality. */
export function editorsEqual(
  a: AgentEditorState,
  b: AgentEditorState,
): boolean {
  if (
    a.name !== b.name ||
    a.description !== b.description ||
    a.system_prompt !== b.system_prompt
  ) {
    return false;
  }
  return (
    arraysEqual(a.tools, b.tools) &&
    arraysEqual(a.skill_ids, b.skill_ids) &&
    arraysEqual(a.delegate_agent_ids, b.delegate_agent_ids)
  );
}
