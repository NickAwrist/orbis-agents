import type { Tool } from "ollama";
import type { RunContext } from "../RunContext";
import { workspaceService } from "../workspaces/WorkspaceService";
import { BaseTool, type ToolResult, textToolResult } from "./BaseTool";
import {
  loadWorkspaceGitignore,
  requireWorkspace,
  workspaceError,
} from "./workspace";

export class ListFilesTool extends BaseTool {
  constructor() {
    super("list_files", "List all files in the current directory");
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
            path: {
              type: "string",
              description:
                "Directory path (relative to /workspace or absolute under /workspace). If not provided, the current directory is used.",
            },
          },
        },
      },
    };
  }

  override async execute(
    args: Record<string, unknown>,
    ctx?: RunContext,
  ): Promise<ToolResult> {
    const raw =
      typeof args.path === "string" && args.path.length > 0 ? args.path : ".";
    try {
      const workspace = requireWorkspace(ctx);
      const entries = await workspaceService.readDirectory(workspace, raw);
      let files = entries.map((entry) =>
        entry.isDirectory() ? `${entry.name}/` : entry.name,
      );

      const ig = await loadWorkspaceGitignore(workspace, raw);
      files = files.filter(
        (f) => !ig.ignores(f.endsWith("/") ? f.slice(0, -1) : f),
      );

      return textToolResult(`List of files: ${files.join(", ")}`);
    } catch (error) {
      return textToolResult(workspaceError(error));
    }
  }
}
