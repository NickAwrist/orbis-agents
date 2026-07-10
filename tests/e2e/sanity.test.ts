import "../setup";
import { expect, test } from "bun:test";
import { startTestServer } from "../helpers/server";

test("sanity E2E: start server, list agents, create agent", async () => {
  const { url, close } = await startTestServer();
  try {
    // 1. GET /api/agents
    const getResponse = await fetch(`${url}/api/agents`);
    expect(getResponse.status).toBe(200);

    const getData = (await getResponse.json()) as {
      agents: Array<{ id: string; name: string }>;
    };
    expect(getData.agents).toBeArray();

    // Check that we have default seeded agents
    const agentNames = getData.agents.map((a) => a.name);
    expect(agentNames).toContain("general_agent");
    expect(agentNames).toContain("computer_agent");
    expect(agentNames).toContain("coding_agent");

    // 2. POST /api/agents (create a new agent)
    const newAgent = {
      name: "test_custom_agent",
      description: "A custom agent created during E2E sanity test",
      system_prompt: "You are a specialized test agent.",
      tools: ["bash"],
    };

    const postResponse = await fetch(`${url}/api/agents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newAgent),
    });

    expect(postResponse.status).toBe(201);
    const postData = (await postResponse.json()) as {
      id: string;
      name: string;
      description: string;
      system_prompt: string;
    };
    expect(postData.id).toBeString();
    expect(postData.name).toBe("test_custom_agent");
    expect(postData.description).toBe(
      "A custom agent created during E2E sanity test",
    );

    // 3. GET /api/agents again to confirm custom agent is listed
    const getResponse2 = await fetch(`${url}/api/agents`);
    expect(getResponse2.status).toBe(200);
    const getData2 = (await getResponse2.json()) as {
      agents: Array<{ id: string; name: string }>;
    };
    const agentNames2 = getData2.agents.map((a) => a.name);
    expect(agentNames2).toContain("test_custom_agent");
  } finally {
    await close();
  }
});
