import "../setup";
import { describe, expect, test } from "bun:test";
import { startTestServer, userHeaders } from "../helpers/server";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("browser UUID ownership", () => {
  test("isolates chats, agents, and agent defaults while connections stay global", async () => {
    const { url, close } = await startTestServer();
    try {
      expect((await fetch(`${url}/api/agents`)).status).toBe(400);

      const agentsAResponse = await fetch(`${url}/api/agents`, {
        headers: userHeaders(USER_A),
      });
      const agentsBResponse = await fetch(`${url}/api/agents`, {
        headers: userHeaders(USER_B),
      });
      const agentsA = (await agentsAResponse.json()) as {
        agents: Array<{ id: string; name: string }>;
      };
      const agentsB = (await agentsBResponse.json()) as {
        agents: Array<{ id: string; name: string }>;
      };
      expect(agentsA.agents.map((agent) => agent.name)).toEqual(
        agentsB.agents.map((agent) => agent.name),
      );
      expect(agentsA.agents[0]?.id).not.toBe(agentsB.agents[0]?.id);

      const createAgent = await fetch(`${url}/api/agents`, {
        method: "POST",
        headers: userHeaders(USER_A, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: "private_agent",
          description: "Only user A can see this",
          system_prompt: "Private",
          tools: [],
        }),
      });
      expect(createAgent.status).toBe(201);
      const privateAgent = (await createAgent.json()) as { id: string };

      const listB = await fetch(`${url}/api/agents`, {
        headers: userHeaders(USER_B),
      });
      expect(JSON.stringify(await listB.json())).not.toContain("private_agent");
      expect(
        (
          await fetch(`${url}/api/agents/${privateAgent.id}`, {
            headers: userHeaders(USER_B),
          })
        ).status,
      ).toBe(404);

      const setDefaultA = await fetch(`${url}/api/settings/default-run-agent`, {
        method: "PUT",
        headers: userHeaders(USER_A, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ agentName: "private_agent" }),
      });
      expect(setDefaultA.status).toBe(200);
      const defaultB = await fetch(`${url}/api/settings/default-run-agent`, {
        headers: userHeaders(USER_B),
      });
      expect(await defaultB.json()).toEqual({ agentName: "general_agent" });

      const createSessionA = await fetch(`${url}/api/sessions`, {
        method: "POST",
        headers: userHeaders(USER_A, { "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      const sessionA = (await createSessionA.json()) as { id: string };
      expect(createSessionA.status).toBe(201);

      const sessionsB = await fetch(`${url}/api/sessions`, {
        headers: userHeaders(USER_B),
      });
      expect(await sessionsB.json()).toEqual({ sessions: [] });
      expect(
        (
          await fetch(`${url}/api/sessions/${sessionA.id}`, {
            headers: userHeaders(USER_B),
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await fetch(`${url}/api/sessions/${sessionA.id}`, {
            method: "DELETE",
            headers: userHeaders(USER_B),
          })
        ).status,
      ).toBe(404);

      const forbiddenRun = await fetch(`${url}/api/runs`, {
        method: "POST",
        headers: userHeaders(USER_B, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          sessionId: sessionA.id,
          message: "Hello",
          history: [],
          model: "llama3:latest",
          agentName: "general_agent",
        }),
      });
      expect(forbiddenRun.status).toBe(404);

      await fetch(`${url}/api/ollama/config`, {
        method: "PUT",
        headers: userHeaders(USER_A, { "Content-Type": "application/json" }),
        body: JSON.stringify({ host: "http://global-ollama.test" }),
      });
      const globalConfig = await fetch(`${url}/api/ollama/config`, {
        headers: userHeaders(USER_B),
      });
      expect(await globalConfig.json()).toMatchObject({
        host: "http://global-ollama.test",
      });
    } finally {
      await close();
    }
  });
});
