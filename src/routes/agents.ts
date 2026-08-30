import { Router } from "express";
import {
  AgentCapabilityValidationError,
  createAgentRow,
  deleteAgentRow,
  getAgentById,
  listAgents,
  updateAgentRow,
} from "../db/index";
import { sendApiError } from "../http/errors";
import { requireUserId } from "../userIdentity";

const agentsRoutes = Router();

type AgentWriteBody = {
  name?: unknown;
  description?: unknown;
  system_prompt?: unknown;
  tools?: unknown;
  skill_ids?: unknown;
  delegate_agent_ids?: unknown;
};

function parseStringArray(
  value: unknown,
  field: string,
): { ok: true; value: string[] } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, value: [] };
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || !item.trim())
  ) {
    return { ok: false, error: `${field} must be an array of strings` };
  }
  return {
    ok: true,
    value: [...new Set(value.map((item) => (item as string).trim()))],
  };
}

function parseAgentBody(body: AgentWriteBody):
  | {
      ok: true;
      data: {
        name: string;
        description: string;
        system_prompt: string;
        tools: string[];
        skill_ids: string[];
        delegate_agent_ids: string[];
      };
    }
  | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { ok: false, error: "name is required" };
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const system_prompt =
    typeof body.system_prompt === "string" ? body.system_prompt.trim() : "";
  const tools = parseStringArray(body.tools, "tools");
  if (!tools.ok) return tools;
  const skillIds = parseStringArray(body.skill_ids, "skill_ids");
  if (!skillIds.ok) return skillIds;
  const delegateAgentIds = parseStringArray(
    body.delegate_agent_ids,
    "delegate_agent_ids",
  );
  if (!delegateAgentIds.ok) return delegateAgentIds;
  return {
    ok: true,
    data: {
      name,
      description,
      system_prompt,
      tools: tools.value,
      skill_ids: skillIds.value,
      delegate_agent_ids: delegateAgentIds.value,
    },
  };
}

function sendAgentWriteError(
  res: Parameters<typeof sendApiError>[0],
  error: unknown,
) {
  if (error instanceof AgentCapabilityValidationError) {
    sendApiError(res, 400, "VALIDATION_ERROR", error.message);
    return true;
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("UNIQUE constraint")) {
    sendApiError(
      res,
      409,
      "CONFLICT",
      "An agent with that name already exists",
    );
    return true;
  }
  return false;
}

agentsRoutes.get("/", (req, res) => {
  const ownerUuid = requireUserId(req, res);
  if (!ownerUuid) return;
  res.json({ agents: listAgents(ownerUuid) });
});

agentsRoutes.get("/:id", (req, res) => {
  const ownerUuid = requireUserId(req, res);
  if (!ownerUuid) return;
  const agent = getAgentById(ownerUuid, req.params.id);
  if (!agent) {
    sendApiError(res, 404, "NOT_FOUND", "Agent not found");
    return;
  }
  res.json(agent);
});

agentsRoutes.post("/", (req, res) => {
  const ownerUuid = requireUserId(req, res);
  if (!ownerUuid) return;
  const parsed = parseAgentBody(req.body as AgentWriteBody);
  if (!parsed.ok) {
    sendApiError(res, 400, "VALIDATION_ERROR", parsed.error);
    return;
  }
  try {
    const agent = createAgentRow(ownerUuid, parsed.data);
    res.status(201).json(agent);
  } catch (error: unknown) {
    if (sendAgentWriteError(res, error)) return;
    throw error;
  }
});

agentsRoutes.put("/:id", (req, res) => {
  const ownerUuid = requireUserId(req, res);
  if (!ownerUuid) return;
  const parsed = parseAgentBody(req.body as AgentWriteBody);
  if (!parsed.ok) {
    sendApiError(res, 400, "VALIDATION_ERROR", parsed.error);
    return;
  }
  try {
    const ok = updateAgentRow(ownerUuid, req.params.id, parsed.data);
    if (!ok) {
      sendApiError(res, 404, "NOT_FOUND", "Agent not found");
      return;
    }
    res.json({ ok: true });
  } catch (error: unknown) {
    if (sendAgentWriteError(res, error)) return;
    throw error;
  }
});

agentsRoutes.delete("/:id", (req, res) => {
  const ownerUuid = requireUserId(req, res);
  if (!ownerUuid) return;
  const ok = deleteAgentRow(ownerUuid, req.params.id);
  if (!ok) {
    sendApiError(
      res,
      400,
      "BAD_REQUEST",
      "Agent not found or cannot delete the required general_agent fallback",
    );
    return;
  }
  res.json({ ok: true });
});

export default agentsRoutes;
