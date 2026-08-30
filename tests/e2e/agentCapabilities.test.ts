import "../setup";
import { expect, test } from "bun:test";
import { startTestServer, userHeaders } from "../helpers/server";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function createSkill(url: string, name: string, ownerUuid?: string) {
  const response = await fetch(`${url}/api/skills`, {
    method: "POST",
    headers: userHeaders(ownerUuid, JSON_HEADERS),
    body: JSON.stringify({
      name,
      description: "Write release notes.",
      instructions: "Lead with user-visible changes.",
    }),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string };
}

test("agent API persists tools, skills, and ID-based delegation routes", async () => {
  const { url, close } = await startTestServer();
  try {
    const skill = await createSkill(url, "agent-capability-one");
    const defaultsResponse = await fetch(`${url}/api/agents`, {
      headers: userHeaders(),
    });
    const defaults = (await defaultsResponse.json()) as {
      agents: Array<{ id: string; name: string }>;
    };
    const coding = defaults.agents.find(
      (agent) => agent.name === "coding_agent",
    );
    const computer = defaults.agents.find(
      (agent) => agent.name === "computer_agent",
    );
    expect(coding).toBeDefined();
    expect(computer).toBeDefined();

    const createResponse = await fetch(`${url}/api/agents`, {
      method: "POST",
      headers: userHeaders(undefined, JSON_HEADERS),
      body: JSON.stringify({
        name: "release_manager",
        description: "Coordinates releases.",
        system_prompt: "Coordinate this release.",
        tools: ["bash"],
        skill_ids: [skill.id],
        delegate_agent_ids: [coding!.id],
      }),
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      id: string;
      tools: string[];
      skill_ids: string[];
      delegate_agent_ids: string[];
    };
    expect(created).toMatchObject({
      tools: ["bash"],
      skill_ids: [skill.id],
      delegate_agent_ids: [coding!.id],
    });

    const updateResponse = await fetch(`${url}/api/agents/${created.id}`, {
      method: "PUT",
      headers: userHeaders(undefined, JSON_HEADERS),
      body: JSON.stringify({
        name: "release_manager",
        description: "Coordinates releases.",
        system_prompt: "Coordinate this release.",
        tools: ["web_search", "web_search"],
        skill_ids: [skill.id, skill.id],
        delegate_agent_ids: [computer!.id, computer!.id],
      }),
    });
    expect(updateResponse.status).toBe(200);

    const detailResponse = await fetch(`${url}/api/agents/${created.id}`, {
      headers: userHeaders(),
    });
    expect(await detailResponse.json()).toMatchObject({
      id: created.id,
      tools: ["web_search"],
      skill_ids: [skill.id],
      delegate_agent_ids: [computer!.id],
    });

    const listResponse = await fetch(`${url}/api/agents`, {
      headers: userHeaders(),
    });
    const list = (await listResponse.json()) as {
      agents: Array<{ id: string; skill_ids: string[] }>;
    };
    expect(
      list.agents.find((agent) => agent.id === created.id)?.skill_ids,
    ).toEqual([skill.id]);

    const deleteSkill = await fetch(`${url}/api/skills/${skill.id}`, {
      method: "DELETE",
      headers: userHeaders(),
    });
    expect(deleteSkill.status).toBe(200);
    const afterDelete = await fetch(`${url}/api/agents/${created.id}`, {
      headers: userHeaders(),
    });
    expect(await afterDelete.json()).toMatchObject({ skill_ids: [] });
  } finally {
    await close();
  }
});

test("invalid capability IDs and self-routes return 400 without partial writes", async () => {
  const { url, close } = await startTestServer();
  const otherUser = "22222222-2222-4222-8222-222222222222";
  try {
    const ownSkill = await createSkill(url, "agent-capability-own");
    const otherSkill = await createSkill(
      url,
      "agent-capability-other",
      otherUser,
    );
    const otherAgentsResponse = await fetch(`${url}/api/agents`, {
      headers: userHeaders(otherUser),
    });
    const otherAgents = (await otherAgentsResponse.json()) as {
      agents: Array<{ id: string; name: string }>;
    };
    const otherAgent = otherAgents.agents.find(
      (agent) => agent.name === "coding_agent",
    );
    expect(otherAgent).toBeDefined();
    const createResponse = await fetch(`${url}/api/agents`, {
      method: "POST",
      headers: userHeaders(undefined, JSON_HEADERS),
      body: JSON.stringify({
        name: "source",
        description: "Source agent.",
        system_prompt: "Original prompt.",
        tools: ["bash"],
        skill_ids: [ownSkill.id],
        delegate_agent_ids: [],
      }),
    });
    const source = (await createResponse.json()) as { id: string };

    for (const invalidBody of [
      {
        name: "changed",
        description: "Changed.",
        system_prompt: "Changed prompt.",
        tools: ["web_search"],
        skill_ids: [otherSkill.id],
        delegate_agent_ids: [],
      },
      {
        name: "changed",
        description: "Changed.",
        system_prompt: "Changed prompt.",
        tools: ["web_search"],
        skill_ids: ["00000000-0000-4000-8000-000000000000"],
        delegate_agent_ids: [],
      },
      {
        name: "changed",
        description: "Changed.",
        system_prompt: "Changed prompt.",
        tools: ["web_search"],
        skill_ids: [ownSkill.id],
        delegate_agent_ids: [otherAgent!.id],
      },
      {
        name: "changed",
        description: "Changed.",
        system_prompt: "Changed prompt.",
        tools: ["web_search"],
        skill_ids: [ownSkill.id],
        delegate_agent_ids: ["00000000-0000-4000-8000-000000000000"],
      },
      {
        name: "changed",
        description: "Changed.",
        system_prompt: "Changed prompt.",
        tools: ["web_search"],
        skill_ids: [ownSkill.id],
        delegate_agent_ids: [source.id],
      },
    ]) {
      const invalid = await fetch(`${url}/api/agents/${source.id}`, {
        method: "PUT",
        headers: userHeaders(undefined, JSON_HEADERS),
        body: JSON.stringify(invalidBody),
      });
      expect(invalid.status).toBe(400);
      expect(await invalid.json()).toMatchObject({
        error: { code: "VALIDATION_ERROR" },
      });
    }

    const detail = await fetch(`${url}/api/agents/${source.id}`, {
      headers: userHeaders(),
    });
    expect(await detail.json()).toMatchObject({
      name: "source",
      system_prompt: "Original prompt.",
      tools: ["bash"],
      skill_ids: [ownSkill.id],
      delegate_agent_ids: [],
    });

    const invalidCreate = await fetch(`${url}/api/agents`, {
      method: "POST",
      headers: userHeaders(undefined, JSON_HEADERS),
      body: JSON.stringify({
        name: "never_created",
        description: "Invalid agent.",
        system_prompt: "Invalid.",
        tools: [],
        skill_ids: ["missing"],
        delegate_agent_ids: [],
      }),
    });
    expect(invalidCreate.status).toBe(400);
    const agents = await fetch(`${url}/api/agents`, { headers: userHeaders() });
    const body = (await agents.json()) as { agents: Array<{ name: string }> };
    expect(
      body.agents.some((agent) => agent.name === "never_created"),
    ).toBeFalse();
  } finally {
    await close();
  }
});
