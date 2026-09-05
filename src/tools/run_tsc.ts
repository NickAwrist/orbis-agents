import type { Tool } from "ollama";
import type { RunContext } from "../RunContext";
import { sandboxRunner } from "../sandbox/SandboxRunner";
import { BaseTool, type ToolResult, textToolResult } from "./BaseTool";
import { requireWorkspace } from "./workspace";

export class RunTscTool extends BaseTool {
  constructor() {
    super(
      "run_tsc",
      "Run the TypeScript compiler inside the active workspace.",
    );
  }

  override toTool(): Tool {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: { type: "object", properties: {}, required: [] },
      },
    };
  }

  override async execute(
    _args: Record<string, unknown>,
    ctx?: RunContext,
  ): Promise<ToolResult> {
    try {
      const result = await sandboxRunner.run({
        command: "npx --offline tsc --noEmit",
        workspace: requireWorkspace(ctx),
        signal: ctx?.signal,
      });
      const output = [result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n")
        .trim();
      if (result.exitCode === 0 && !output)
        return textToolResult("No type errors found.");
      return textToolResult(
        output || `TypeScript exited with status ${result.exitCode}`,
      );
    } catch (error) {
      return textToolResult(
        `Error running TypeScript: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
