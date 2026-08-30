import type { Tool } from "ollama";
import type { RunContext, Step } from "../RunContext";
import { agentManager } from "../agents/agentManager";
import { BaseTool } from "./BaseTool";

export type AgentToolTarget = {
  id: string;
  name: string;
  description: string;
};

export function delegationToolName(
  target: Pick<AgentToolTarget, "id" | "name">,
) {
  const normalizedName =
    target.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 18) || "agent";
  const stableId = target.id
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 32);
  return `delegate_to_${normalizedName}_${stableId || "unknown"}`;
}

export class AgentTool extends BaseTool {
  constructor(readonly target: AgentToolTarget) {
    super(
      delegationToolName(target),
      `Delegate to ${target.name}: ${target.description || "No description provided."}`,
    );
  }

  override toTool(): Tool {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: "object",
          properties: {
            task: {
              type: "string",
              description:
                "The overall task to perform. Ensure this is a simple text prompt. If you have long code snippets, use task_lines instead.",
            },
            task_lines: {
              type: "array",
              items: { type: "string" },
              description:
                "The overall task to perform, split into an array of strings. Use this instead of 'task' if your prompt contains multiple lines or code.",
            },
          },
          required: [],
        },
      },
    };
  }

  override async execute(
    args: Record<string, unknown>,
    ctx?: RunContext,
    parentToolStep?: Step,
  ): Promise<string> {
    const task =
      typeof args.task === "string"
        ? args.task
        : Array.isArray(args.task_lines)
          ? args.task_lines.join("\n")
          : "";
    if (!task) return "Error: you must provide a task or task_lines";

    if (!ctx || !parentToolStep) {
      return "Error: missing context for sub-agent invocation";
    }
    const agent = agentManager.createAgentByIdForContext(
      this.target.id,
      ctx,
      task,
    );
    const childCtx = ctx.createChild(agent, task, parentToolStep);
    return agent.run(task, childCtx);
  }
}
