import type { RunContext } from "../RunContext";
import { type Workspace, WorkspaceError } from "../workspaces/WorkspaceService";

export function requireWorkspace(ctx?: RunContext): Workspace {
  if (!ctx?.workspace) {
    throw new WorkspaceError("No active workspace is available for this tool");
  }
  return ctx.workspace;
}

export function workspaceError(error: unknown): string {
  return error instanceof Error
    ? `Error: ${error.message}`
    : "Error: workspace operation failed";
}
