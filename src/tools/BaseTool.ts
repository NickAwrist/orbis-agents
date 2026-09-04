import type { Tool } from "ollama";
import type { RunContext, Step } from "../RunContext";
import type { LlmImage } from "../llm/types";

export type ToolResult = {
  text: string;
  images?: LlmImage[];
  redactedArgs?: Record<string, unknown>;
};

export function textToolResult(text: string): ToolResult {
  return { text };
}

export class BaseTool {
  name: string;
  description: string;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  async execute(
    args: Record<string, unknown>,
    _ctx?: RunContext,
    _parentToolStep?: Step,
  ): Promise<ToolResult> {
    throw new Error("Tool not implemented");
  }

  toTool(): Tool {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
      },
    };
  }
}
