export type AgentEditorState = {
  name: string;
  description: string;
  system_prompt: string;
  tools: string[];
  skill_ids: string[];
  delegate_agent_ids: string[];
};
