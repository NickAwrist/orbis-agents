import "../setup";
import { describe, expect, test } from "bun:test";
import {
  getOpenRouterApiKey,
  listOpenRouterModels,
  setOllamaHost,
  setOpenRouterApiKey,
} from "../../src/db";
import { setOpenRouterScenario } from "../helpers/mockOpenRouter";
import { startTestServer, userHeaders } from "../helpers/server";

const runBody = (model: string) => ({
  ephemeral: true,
  message: "Hello",
  history: [],
  model,
  agentName: "general_agent",
});

describe("OpenRouter API integration", () => {
  test("exposes a provider-aware model catalog even when one provider fails", async () => {
    setOllamaHost("http://ollama.test");
    setOpenRouterApiKey("");
    const { url, close } = await startTestServer();
    try {
      let response = await fetch(`${url}/api/models`);
      expect(response.status).toBe(200);
      let body = (await response.json()) as {
        models: Array<{
          id: string;
          provider: string;
          configured?: boolean;
        }>;
      };
      expect(
        body.models.some((model) => model.provider === "ollama"),
      ).toBeTrue();
      const remote = body.models.find(
        (model) => model.provider === "openrouter",
      );
      expect(remote?.id.startsWith("openrouter:")).toBeTrue();
      expect(remote?.configured).toBeFalse();

      await fetch(`${url}/api/settings/openrouter`, {
        method: "PUT",
        headers: userHeaders(undefined, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ apiKey: "sk-or-api-test" }),
      });
      response = await fetch(`${url}/api/models`);
      body = await response.json();
      expect(
        body.models
          .filter((model) => model.provider === "openrouter")
          .every((model) => model.configured === true),
      ).toBeTrue();
    } finally {
      await close();
    }
  });

  test("manages registry entries through the real settings routes", async () => {
    const { url, close } = await startTestServer();
    try {
      const create = await fetch(`${url}/api/settings/openrouter/models`, {
        method: "POST",
        headers: userHeaders(undefined, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ route: "example/test-model" }),
      });
      expect(create.status).toBe(201);
      const created = (await create.json()) as {
        id: number;
        name: string;
        ai_lab: string;
      };
      expect(created.name).toBe("Test Model");
      expect(created.ai_lab).toBe("Example AI");

      const lookup = await fetch(
        `${url}/api/settings/openrouter/models/lookup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ route: "openai/gpt-5.4-mini" }),
        },
      );
      expect(lookup.status).toBe(200);
      expect(await lookup.json()).toMatchObject({
        name: "GPT-5.4 Mini",
        ai_lab: "OpenAI",
        found: true,
      });

      const duplicate = await fetch(`${url}/api/settings/openrouter/models`, {
        method: "POST",
        headers: userHeaders(undefined, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ route: "example/test-model" }),
      });
      expect(duplicate.status).toBe(409);

      const remove = await fetch(
        `${url}/api/settings/openrouter/models/${created.id}`,
        { method: "DELETE" },
      );
      expect(remove.status).toBe(200);
      expect(
        listOpenRouterModels().some((model) => model.id === created.id),
      ).toBeFalse();
    } finally {
      await close();
    }
  });

  test("validates configuration and runs through the existing agent flow", async () => {
    const route = "openai/gpt-5.6-terra";
    const model = `openrouter:${route}`;
    const { url, close } = await startTestServer();
    try {
      setOpenRouterApiKey("");
      let response = await fetch(`${url}/api/runs`, {
        method: "POST",
        headers: userHeaders(undefined, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(runBody(model)),
      });
      expect(response.status).toBe(400);
      expect(await response.text()).toContain(
        "Configure an OpenRouter API key",
      );

      setOpenRouterApiKey("sk-or-run-test");
      response = await fetch(`${url}/api/runs`, {
        method: "POST",
        headers: userHeaders(undefined, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(runBody("openrouter:missing/model")),
      });
      expect(response.status).toBe(400);

      response = await fetch(`${url}/api/runs`, {
        method: "POST",
        headers: userHeaders(undefined, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(runBody(model)),
      });
      expect(response.status).toBe(200);
      const stream = await response.text();
      expect(stream).toContain('"type":"run_delta"');
      expect(stream).toContain("Hello from OpenRouter.");
      expect(stream).toContain('"type":"run_done"');
      expect(getOpenRouterApiKey()).toBe("sk-or-run-test");
    } finally {
      await close();
    }
  });

  test("finishes and persists a run after its app connection closes", async () => {
    const model = "openrouter:openai/gpt-5.6-terra";
    const { url, close } = await startTestServer();
    try {
      setOpenRouterApiKey("sk-or-background-run-test");
      setOpenRouterScenario("delayed-stream");

      const created = await fetch(`${url}/api/sessions`, {
        method: "POST",
        headers: userHeaders(undefined, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ model }),
      });
      expect(created.status).toBe(201);
      const { id: sessionId } = (await created.json()) as { id: string };

      const response = await fetch(`${url}/api/runs`, {
        method: "POST",
        headers: userHeaders(undefined, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          message: "Keep going in the background",
          history: [],
          model,
          agentName: "general_agent",
          sessionId,
        }),
      });
      expect(response.status).toBe(200);
      const reader = response.body?.getReader();
      expect(reader).toBeDefined();
      await reader?.read();
      await reader?.cancel();

      const deadline = Date.now() + 2_000;
      let history: Array<{
        role: string;
        content: string;
        steps?: Array<Record<string, unknown>>;
      }> = [];
      while (Date.now() < deadline) {
        const stored = await fetch(`${url}/api/sessions/${sessionId}`, {
          headers: userHeaders(),
        });
        history = ((await stored.json()) as { history: typeof history })
          .history;
        if (history.some((message) => message.role === "assistant")) break;
        await Bun.sleep(20);
      }

      expect(history).toEqual([
        { role: "user", content: "Keep going in the background" },
        {
          role: "assistant",
          content: "Hello after closing the app.",
          steps: expect.any(Array),
        },
      ]);
    } finally {
      await close();
    }
  });
});
