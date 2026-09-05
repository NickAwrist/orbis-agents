import type { Tool } from "ollama";
import type { RunContext } from "../RunContext";
import { workspaceService } from "../workspaces/WorkspaceService";
import { BaseTool, type ToolResult, textToolResult } from "./BaseTool";
import { requireWorkspace, workspaceError } from "./workspace";

export class ListFilesTool extends BaseTool {
  constructor() {
    super(
      "list_files",
      "List files in a directory, excluding .git, node_modules, .cache and gitignored entries",
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
      const entries = await workspaceService.readVisibleDirectory(
        workspace,
        raw,
      );
      const files = entries.map((entry) =>
        entry.isDirectory() ? `${entry.name}/` : entry.name,
      );

      return textToolResult(`List of files: ${files.join(", ")}`);
    } catch (error) {
      return textToolResult(workspaceError(error));
    }
  }
}
