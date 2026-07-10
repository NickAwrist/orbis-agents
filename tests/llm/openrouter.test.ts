import "../setup";
import { describe, expect, test } from "bun:test";
import { RunContext } from "../../src/RunContext";
import { BaseAgent } from "../../src/agents/BaseAgent";
import {
  setOpenRouterApiKey,
  setOpenRouterPromptCachingEnabled,
} from "../../src/db";
import { streamOpenRouterChat } from "../../src/llm/openRouterProvider";
import type { LlmStreamChunk } from "../../src/llm/types";
import { AgentSession } from "../../src/session/AgentSession";
import {
  getOpenRouterRequests,
  setOpenRouterScenario,
} from "../helpers/mockOpenRouter";

const model = "openai/gpt-5.4-mini";

async function collect(): Promise<LlmStreamChunk[]> {
  const stream = await streamOpenRouterChat({
    model,
    messages: [{ role: "user", content: "Hello" }],
    tools: [],
  });
  const chunks: LlmStreamChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

describe("OpenRouter provider", () => {
  test("streams content, usage, and authenticated provider metadata", async () => {
    setOpenRouterApiKey("sk-or-secret-test");
    const chunks = await collect();
    expect(chunks.map((chunk) => chunk.contentDelta ?? "").join("")).toBe(
      "Hello from OpenRouter.",
    );
    expect(chunks.at(-1)?.metrics).toMatchObject({
      cost: 0.00042,
      promptTokens: 10,
      outputTokens: 5,
      cachedTokens: 8,
      cacheWriteTokens: 2,
    });
    expect(chunks.at(-1)?.metrics?.outputDurationMs).toBeGreaterThan(0);
    expect(chunks.at(-1)?.metrics?.tokensPerSecond).toBeGreaterThan(0);

    const request = getOpenRouterRequests()[0]!;
    expect(request.headers.get("authorization")).toBe(
      "Bearer sk-or-secret-test",
    );
    expect(request.body.model).toBe(model);
    expect(request.body.stream).toBeTrue();
    expect(JSON.stringify(request.body)).not.toContain("sk-or-secret-test");
  });

  test("adds cache control and stable session routing only when enabled", async () => {
    setOpenRouterApiKey("sk-or-test");
    setOpenRouterPromptCachingEnabled(true);
    const stream = await streamOpenRouterChat({
      model,
      messages: [{ role: "user", content: "Hello" }],
      tools: [],
      sessionId: "app-session-123",
    });
    for await (const _chunk of stream) {
      // Drain the stream so the mock records a complete request lifecycle.
    }

    expect(getOpenRouterRequests()[0]?.body).toMatchObject({
      session_id: "app-session-123",
      cache_control: { type: "ephemeral" },
    });

    setOpenRouterPromptCachingEnabled(false);
    await collect();
    const disabled = getOpenRouterRequests()[1]?.body;
    expect(disabled?.session_id).toBeUndefined();
    expect(disabled?.cache_control).toBeUndefined();
  });

  test("passes the persisted app conversation ID through the agent session", async () => {
    setOpenRouterApiKey("sk-or-test");
    setOpenRouterPromptCachingEnabled(true);
    const session = new AgentSession("persisted-conversation-123", {
      model: `openrouter:${model}`,
      agentName: "general_agent",
    });

    expect(await session.sendRun("Hello")).toBe("Hello from OpenRouter.");
    expect(getOpenRouterRequests()[0]?.body.session_id).toBe(
      "persisted-conversation-123",
    );
  });

  test("normalizes reasoning fields and split thinking tags", async () => {
    setOpenRouterApiKey("sk-or-test");
    setOpenRouterScenario("reasoning");
    let chunks = await collect();
    expect(chunks.map((chunk) => chunk.thinkingDelta ?? "").join("")).toBe(
      "Checking assumptions. Comparing options.",
    );
    expect(
      chunks.flatMap((chunk) => chunk.reasoningDetails ?? []),
    ).toHaveLength(1);
    expect(chunks.at(-1)?.reasoningDetails).toEqual([
      {
        type: "reasoning.summary",
        summary: "Comparing options.",
        id: "reasoning-1",
        format: "test",
        index: 0,
      },
    ]);

    setOpenRouterScenario("thinking-tags");
    chunks = await collect();
    expect(chunks.map((chunk) => chunk.thinkingDelta ?? "").join("")).toBe(
      "Private thought",
    );
    expect(chunks.map((chunk) => chunk.contentDelta ?? "").join("")).toBe(
      "Public answer",
    );
  });

  test("assembles tool fragments and preserves tool_call_id in the loop", async () => {
    setOpenRouterApiKey("sk-or-test");
    setOpenRouterScenario("tool-loop");
    const agent = new BaseAgent(
      "test_agent",
      "Test agent",
      [],
      `openrouter:${model}`,
      "Be concise.",
    );
    const context = new RunContext(agent, "Use a tool");

    expect(await agent.run("Use a tool", context)).toBe("Finished after tool.");
    const requests = getOpenRouterRequests();
    expect(requests).toHaveLength(2);
    const secondMessages = requests[1]!.body.messages as Array<
      Record<string, unknown>
    >;
    expect(secondMessages.at(-1)).toEqual({
      role: "tool",
      content: "Error: tool missing_tool not found",
      tool_call_id: "call_test_1",
    });
    const assistantMessage = secondMessages.find(
      (message) => message.role === "assistant",
    );
    expect(assistantMessage?.reasoning_details).toEqual([
      {
        type: "reasoning.summary",
        summary: "I should use a tool.",
        id: "tool-reasoning-1",
        format: "test",
        index: 0,
      },
    ]);
    expect(assistantMessage?.reasoning).toBeUndefined();
    expect(
      agent.history.some(
        (message) =>
          message.reasoning !== undefined ||
          message.reasoning_details !== undefined,
      ),
    ).toBeFalse();
  });

  test("surfaces provider and stream errors without leaking the key", async () => {
    setOpenRouterApiKey("sk-or-do-not-leak");
    setOpenRouterScenario("unauthorized");
    expect(collect()).rejects.toThrow("Invalid API key");

    setOpenRouterScenario("corrupted-stream");
    expect(collect()).rejects.toThrow("invalid streaming response");
  });
});
