import type { Plan } from "../Plan";
import type { LlmMetrics, RunContext, Step } from "../RunContext";
import { DEFAULT_RUN_MODEL } from "../constants";
import {
  type LlmMessage,
  type LlmToolCall,
  streamModelChat,
} from "../llm/index";
import { logger } from "../logger";
import { CORE_DIRECTIVES } from "../prompts/render";
import type { BaseTool } from "../tools/BaseTool";
import { toolErrorToString } from "../tools/errors";

const log = logger.child({ component: "BaseAgent" });

export class BaseAgent {
  model: string;
  systemPrompt?: string;
  name: string;
  description: string;
  tools: BaseTool[];
  history: LlmMessage[];

  TOOL_MAP: Record<string, BaseTool>;

  plan?: Plan;

  constructor(
    name: string,
    description: string,
    tools?: BaseTool[],
    model?: string,
    systemPrompt?: string,
  ) {
    this.name = name;
    this.description = description;

    this.tools = tools || [];
    this.model = model ?? DEFAULT_RUN_MODEL;
    const base = typeof systemPrompt === "string" ? systemPrompt.trim() : "";
    this.systemPrompt = base
      ? `${base}\n\n${CORE_DIRECTIVES}`
      : CORE_DIRECTIVES;

    this.history = [];

    this.TOOL_MAP = {};
  }

  addTool(tool: BaseTool): void {
    if (this.TOOL_MAP[tool.name]) {
      throw new Error(`Tool ${tool.name} already added`);
    }
    this.TOOL_MAP[tool.name] = tool;
    this.tools.push(tool);
  }

  addTools(tools: BaseTool[]): void {
    for (const tool of tools) {
      this.addTool(tool);
    }
  }

  private async executeToolCall(
    toolCall: LlmToolCall,
    ctx?: RunContext,
    parentStep?: Step,
    turnIndex?: number,
  ): Promise<string> {
    const toolName = toolCall.function.name;
    const args = this.parseToolArguments(toolCall.function.arguments);
    const startedAt = Date.now();
    log.debug({
      event: "tool_call_start",
      toolName,
      agentName: ctx?.agentName,
      turnIndex,
    });

    const tool = this.TOOL_MAP[toolName];
    if (!tool) {
      log.debug({
        event: "tool_call_done",
        toolName,
        agentName: ctx?.agentName,
        turnIndex,
        runMs: Date.now() - startedAt,
      });
      return `Error: tool ${toolName} not found`;
    }

    try {
      return await tool.execute(args, ctx, parentStep);
    } catch (e) {
      return `Error: ${toolErrorToString(e, toolName, ctx?.sessionDir)}`;
    } finally {
      log.debug({
        event: "tool_call_done",
        toolName,
        agentName: ctx?.agentName,
        turnIndex,
        runMs: Date.now() - startedAt,
      });
    }
  }

  private parseToolArguments(raw: unknown): Record<string, unknown> {
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        /* ignore */
      }
      return {};
    }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    return {};
  }

  async run(prompt: string, ctx?: RunContext): Promise<string> {
    if (!ctx) {
      throw new Error("RunContext is required to run the agent");
    }
    const signal = ctx.signal;
    const systemMsg: { role: string; content: string } | undefined = this
      .systemPrompt
      ? { role: "system", content: this.systemPrompt }
      : undefined;

    let userMessage = prompt;
    let fullContent = "";
    let fullThinking = "";
    let toolCalls: LlmToolCall[] = [];
    let turnIndex = 0;

    do {
      if (signal?.aborted) break;

      const llmStep = ctx.beginStep({ kind: "llm_call", turnIndex });

      const messages = [
        systemMsg || { role: "system", content: "" },
        ...this.history,
      ];
      if (userMessage) {
        messages.push({ role: "user", content: userMessage });
      }

      fullContent = "";
      fullThinking = "";
      toolCalls = [];
      const reasoningDetails: unknown[] = [];
      let llmMetrics: LlmMetrics | undefined;

      const stream = await streamModelChat({
        model: this.model,
        messages,
        tools: this.tools.map((tool) => tool.toTool()),
      });

      const onAbort = () => stream.abort();
      if (signal?.aborted) {
        stream.abort();
      } else {
        signal?.addEventListener("abort", onAbort, { once: true });
      }

      try {
        for await (const chunk of stream) {
          if (signal?.aborted) break;

          const cDelta = chunk.contentDelta ?? "";
          const tDelta = chunk.thinkingDelta ?? "";

          if (cDelta) fullContent += cDelta;
          if (tDelta) fullThinking += tDelta;

          if (cDelta || tDelta) {
            ctx.streamDelta(cDelta, tDelta);
          }

          if (chunk.toolCalls?.length) {
            toolCalls = chunk.toolCalls;
          }

          if (chunk.metrics) llmMetrics = chunk.metrics;
          if (chunk.reasoningDetails?.length) {
            reasoningDetails.push(...chunk.reasoningDetails);
          }
        }
      } catch (e) {
        if (!signal?.aborted) throw e;
      } finally {
        signal?.removeEventListener("abort", onAbort);
      }

      if (signal?.aborted) {
        ctx.endStep(
          llmStep,
          fullContent || "[aborted]",
          fullThinking || undefined,
          llmMetrics,
        );
        break;
      }

      if (fullContent && toolCalls.length) {
        const toolStr = `-> ${toolCalls.map((c) => c.function.name).join(", ")}`;
        ctx.endStep(
          llmStep,
          `${fullContent}\n\n${toolStr}`,
          fullThinking || undefined,
          llmMetrics,
        );
      } else if (fullContent) {
        ctx.endStep(
          llmStep,
          fullContent,
          fullThinking || undefined,
          llmMetrics,
        );
      } else if (toolCalls.length) {
        ctx.endStep(
          llmStep,
          `-> ${toolCalls.map((c) => c.function.name).join(", ")}`,
          fullThinking || undefined,
          llmMetrics,
        );
      } else {
        ctx.endStep(llmStep, "", fullThinking || undefined, llmMetrics);
      }

      if (userMessage) {
        this.history.push({ role: "user", content: userMessage });
        userMessage = "";
      }

      const assistantMsg: LlmMessage = {
        role: "assistant",
        content: fullContent,
      };
      if (toolCalls.length > 0) {
        assistantMsg.tool_calls = toolCalls;
      }
      if (reasoningDetails.length > 0) {
        assistantMsg.reasoning_details = reasoningDetails;
      } else if (fullThinking) {
        assistantMsg.reasoning = fullThinking;
      }
      this.history.push(assistantMsg);

      if (toolCalls.length) {
        for (const toolCall of toolCalls) {
          if (signal?.aborted) break;

          const toolName = toolCall.function.name;
          const args = this.parseToolArguments(toolCall.function.arguments);

          const toolStep = ctx.beginStep({
            kind: "tool_call",
            turnIndex,
            toolName,
            args,
          });
          const result = await this.executeToolCall(
            toolCall,
            ctx,
            toolStep,
            turnIndex,
          );
          ctx.endStep(toolStep, result);

          this.history.push({
            role: "tool",
            content: result,
            ...(toolCall.id ? { tool_call_id: toolCall.id } : {}),
          });
        }
        if (signal?.aborted) break;
        userMessage = "";
        turnIndex++;
      }
    } while (toolCalls.length);

    // OpenRouter reasoning blocks are needed for immediate tool continuation,
    // but replaying them on later user turns adds large provider metadata to input.
    this.history = this.history.map(
      ({ reasoning: _reasoning, reasoning_details: _details, ...message }) =>
        message,
    );

    if (!signal?.aborted) {
      const completeStep = ctx.beginStep({ kind: "complete", turnIndex });
      ctx.endStep(completeStep, fullContent, fullThinking || undefined);
    }

    return fullContent;
  }
}
