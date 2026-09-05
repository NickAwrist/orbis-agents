import { posix } from "node:path";
import ignore from "ignore";
import type { RunContext } from "../RunContext";
import {
  type Workspace,
  WorkspaceError,
  workspaceService,
} from "../workspaces/WorkspaceService";

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

// Read ignore rules only within the workspace and through protected descriptors.
export async function loadWorkspaceGitignore(workspace: Workspace, path = ".") {
  // Validate the original path before normalizing it for the ancestor walk.
  await workspaceService.statPath(workspace, path);
  let current = posix.resolve("/workspace", path);
  const rules: string[] = [];
  while (true) {
    try {
      rules.push(
        await workspaceService.readFile(
          workspace,
          posix.join(current, ".gitignore"),
        ),
      );
    } catch {
      // Missing or symlinked ignore files do not supply rules.
    }
    if (current === "/workspace") break;
    current = posix.dirname(current);
  }
  return ignore().add(rules.reverse());
}
