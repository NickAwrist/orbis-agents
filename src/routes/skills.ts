import { Router } from "express";
import {
  createSkillRow,
  deleteSkillRow,
  getSkillById,
  listSkills,
  updateSkillRow,
} from "../db/index";
import { sendApiError } from "../http/errors";
import { requireUserId } from "../userIdentity";

const skillsRoutes = Router();
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type SkillWriteBody = {
  name?: unknown;
  description?: unknown;
  instructions?: unknown;
};

function parseSkillBody(body: SkillWriteBody):
  | {
      ok: true;
      data: { name: string; description: string; instructions: string };
    }
  | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { ok: false, error: "name is required" };
  if (name.length > 64 || !SKILL_NAME_PATTERN.test(name)) {
    return {
      ok: false,
      error:
        "name must use lowercase letters, numbers, and single hyphens only",
    };
  }

  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (!description) return { ok: false, error: "description is required" };
  if (description.length > 500) {
    return { ok: false, error: "description must be 500 characters or fewer" };
  }

  const instructions =
    typeof body.instructions === "string" ? body.instructions.trim() : "";
  if (!instructions) return { ok: false, error: "instructions are required" };

  return { ok: true, data: { name, description, instructions } };
}

skillsRoutes.get("/", (req, res) => {
  const ownerUuid = requireUserId(req, res);
  if (!ownerUuid) return;
  res.json({ skills: listSkills(ownerUuid) });
});

skillsRoutes.get("/:id", (req, res) => {
  const ownerUuid = requireUserId(req, res);
  if (!ownerUuid) return;
  const skill = getSkillById(ownerUuid, req.params.id);
  if (!skill) {
    sendApiError(res, 404, "NOT_FOUND", "Skill not found");
    return;
  }
  res.json(skill);
});

skillsRoutes.post("/", (req, res) => {
  const ownerUuid = requireUserId(req, res);
  if (!ownerUuid) return;
  const parsed = parseSkillBody(req.body as SkillWriteBody);
  if (!parsed.ok) {
    sendApiError(res, 400, "VALIDATION_ERROR", parsed.error);
    return;
  }
  try {
    res.status(201).json(createSkillRow(ownerUuid, parsed.data));
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
      sendApiError(
        res,
        409,
        "CONFLICT",
        "A skill with that name already exists",
      );
      return;
    }
    throw error;
  }
});

skillsRoutes.put("/:id", (req, res) => {
  const ownerUuid = requireUserId(req, res);
  if (!ownerUuid) return;
  const parsed = parseSkillBody(req.body as SkillWriteBody);
  if (!parsed.ok) {
    sendApiError(res, 400, "VALIDATION_ERROR", parsed.error);
    return;
  }
  try {
    const skill = updateSkillRow(ownerUuid, req.params.id, parsed.data);
    if (!skill) {
      sendApiError(res, 404, "NOT_FOUND", "Skill not found");
      return;
    }
    res.json(skill);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
      sendApiError(
        res,
        409,
        "CONFLICT",
        "A skill with that name already exists",
      );
      return;
    }
    throw error;
  }
});

skillsRoutes.delete("/:id", (req, res) => {
  const ownerUuid = requireUserId(req, res);
  if (!ownerUuid) return;
  if (!deleteSkillRow(ownerUuid, req.params.id)) {
    sendApiError(res, 404, "NOT_FOUND", "Skill not found");
    return;
  }
  res.json({ ok: true });
});

export default skillsRoutes;
