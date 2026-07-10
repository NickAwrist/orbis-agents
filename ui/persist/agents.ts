import { readApiError } from "../lib/readApiError";
import { userScopedFetch } from "./userIdentity";

export type AgentData = {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  is_default: number;
  tools: string[];
  created_at: number;
  updated_at: number;
};

export type AgentWriteBody = {
  name: string;
  description: string;
  system_prompt: string;
  tools: string[];
};

export async function fetchAgents(): Promise<AgentData[]> {
  const res = await userScopedFetch("/api/agents");
  if (!res.ok)
    throw new Error(await readApiError(res, "Failed to fetch agents"));
  const data = await res.json();
  return data.agents;
}

export async function fetchAgent(id: string): Promise<AgentData> {
  const res = await userScopedFetch(`/api/agents/${id}`);
  if (!res.ok)
    throw new Error(await readApiError(res, "Failed to fetch agent"));
  return res.json();
}

export async function createAgentApi(body: AgentWriteBody): Promise<AgentData> {
  const res = await userScopedFetch("/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to create agent"));
  }
  return res.json();
}

export async function updateAgentApi(
  id: string,
  body: AgentWriteBody,
): Promise<void> {
  const res = await userScopedFetch(`/api/agents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to update agent"));
  }
}

export async function deleteAgentApi(id: string): Promise<void> {
  const res = await userScopedFetch(`/api/agents/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to delete agent"));
  }
}

export async function fetchBuiltinTools(): Promise<string[]> {
  const res = await fetch("/api/tools");
  if (!res.ok)
    throw new Error(await readApiError(res, "Failed to fetch tools"));
  const data = await res.json();
  return data.tools;
}

export async function fetchDefaultRunAgent(): Promise<string> {
  const res = await userScopedFetch("/api/settings/default-run-agent");
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to fetch default agent"));
  }
  const data = await res.json();
  return typeof data.agentName === "string" ? data.agentName : "general_agent";
}

export async function putDefaultRunAgentApi(
  agentName: string,
): Promise<string> {
  const res = await userScopedFetch("/api/settings/default-run-agent", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentName }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, "Failed to update default agent"));
  }
  const data = await res.json();
  return typeof data.agentName === "string" ? data.agentName : agentName;
}
