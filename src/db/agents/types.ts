export type AgentRow = {
  id: string;
  owner_uuid: string;
  name: string;
  description: string;
  system_prompt: string;
  is_default: number;
  created_at: number;
  updated_at: number;
};

export type AgentData = AgentRow & {
  tools: string[];
  skill_ids: string[];
  delegate_agent_ids: string[];
};

export type AgentWriteData = {
  name: string;
  description: string;
  system_prompt: string;
  tools: string[];
  skill_ids: string[];
  delegate_agent_ids: string[];
};
