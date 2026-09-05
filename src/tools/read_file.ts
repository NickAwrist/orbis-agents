import type { Tool } from "ollama";
import type { RunContext } from "../RunContext";
import { workspaceService } from "../workspaces/WorkspaceService";
import { BaseTool, type ToolResult, textToolResult } from "./BaseTool";
import { requireWorkspace, workspaceError } from "./workspace";

export class ReadFileTool extends BaseTool {
  constructor() {
    super("read_file", "Read the contents of a file");
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
      const file = await workspaceService.openFile(
        requireWorkspace(ctx),
        rawPath,
      );
      try {
        return textToolResult(await file.readFile("utf8"));
      } finally {
        await file.close();
      }
    } catch (e) {
      return textToolResult(workspaceError(e));
    }
  }
}
