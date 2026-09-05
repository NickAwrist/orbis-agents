import fs from "node:fs/promises";
import type { Tool } from "ollama";
import type { RunContext } from "../RunContext";
import { workspaceService } from "../workspaces/WorkspaceService";
import { BaseTool, type ToolResult, textToolResult } from "./BaseTool";
import { requireWorkspace, workspaceError } from "./workspace";

export class DeleteFileTool extends BaseTool {
  constructor() {
    super("delete_file", "Delete a file");
  }

  override toTool(): Tool {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: "object",
          required: ["path"],
          properties: {
            path: {
              type: "string",
              description:
                "File path (relative to /workspace or absolute under /workspace)",
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
    const rawPath =
      typeof args.path === "string" && args.path.length > 0
        ? args.path
        : typeof args.filename === "string" && args.filename.length > 0
          ? args.filename
          : "";
    try {
      const path = await workspaceService.resolveExistingPath(
        requireWorkspace(ctx),
        rawPath,
      );
      await fs.unlink(path);
      return textToolResult(`File deleted at ${rawPath}`);
    } catch (e) {
      return textToolResult(workspaceError(e));
    }
  }
}
