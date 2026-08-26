import { readApiError } from "../lib/readApiError";
import { userScopedFetch } from "./userIdentity";

export type SkillData = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  created_at: number;
  updated_at: number;
};

export type SkillWriteBody = Pick<
  SkillData,
  "name" | "description" | "instructions"
>;

export async function fetchSkills(): Promise<SkillData[]> {
  const response = await userScopedFetch("/api/skills");
  if (!response.ok) {
    throw new Error(await readApiError(response, "Failed to fetch skills"));
  }
  const data = (await response.json()) as { skills?: SkillData[] };
  return data.skills ?? [];
}

export async function createSkillApi(body: SkillWriteBody): Promise<SkillData> {
  const response = await userScopedFetch("/api/skills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Failed to create skill"));
  }
  return response.json();
}

export async function updateSkillApi(
  id: string,
  body: SkillWriteBody,
): Promise<SkillData> {
  const response = await userScopedFetch(`/api/skills/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Failed to update skill"));
  }
  return response.json();
}

export async function deleteSkillApi(id: string): Promise<void> {
  const response = await userScopedFetch(`/api/skills/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Failed to delete skill"));
  }
}
