import type { Tool } from "ollama";
import type { RunContext } from "../RunContext";
import { sandboxRunner } from "../sandbox/SandboxRunner";
import { filterOutputLines } from "../utils/gitignoreFilter";
import { BaseTool, type ToolResult, textToolResult } from "./BaseTool";
import { loadWorkspaceGitignore, requireWorkspace } from "./workspace";

const DEFAULT_MAX_BUFFER = 2 * 1024 * 1024;

export class BashTool extends BaseTool {
  constructor() {
    super("bash", "Execute a shell command inside the active workspace.");
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
            command: {
              type: "string",
              description: "The shell command to execute.",
            },
          },
          required: ["command"],
        },
      },
    };
  }

  override async execute(
    args: Record<string, unknown>,
    ctx?: RunContext,
  ): Promise<ToolResult> {
    const command = typeof args.command === "string" ? args.command : "";
    if (!command) return textToolResult("Error: No command provided.");
    if (ctx?.signal?.aborted) return textToolResult("[command aborted]");

    try {
      const workspace = requireWorkspace(ctx);
      const result = await sandboxRunner.run({
        command,
        workspace,
        signal: ctx?.signal,
        maxOutputBytes: DEFAULT_MAX_BUFFER,
      });
      let output = "";
      if (result.stdout) {
        const ig = await loadWorkspaceGitignore(workspace);
        const filtered = filterOutputLines(
          result.stdout,
          ig,
          workspace.hostPath,
        );
        output = filtered.filtered;
        if (filtered.removedCount > 0) {
          output += `\n[${filtered.removedCount} gitignored entries hidden]`;
        }
      }
      if (result.stderr) output += `\n--- stderr ---\n${result.stderr}`;
      if (result.truncated) {
        output += `\n[output truncated at ${DEFAULT_MAX_BUFFER} bytes]`;
      }
      if (result.exitCode !== 0) {
        output += `\n[command exited with status ${result.exitCode}]`;
      }
      return textToolResult(
        output || "Command executed successfully with no output.",
      );
    } catch (error) {
      if (ctx?.signal?.aborted) return textToolResult("[command aborted]");
      return textToolResult(
        `Error executing command: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
