import { posix } from "node:path";
import ignore, { type Ignore } from "ignore";
import type { Workspace, WorkspaceService } from "./WorkspaceService";

// Keep build outputs and useful dotfiles visible unless the project ignores them.
const EXCLUDED_NAMES = new Set([".git", "node_modules", ".cache"]);

export async function loadWorkspaceIgnore(
  service: WorkspaceService,
  workspace: Workspace,
  path: string,
) {
  await service.statPath(workspace, path);
  const directory = posix.resolve("/workspace", path);
  const bases: string[] = [];
  for (let base = directory; ; base = posix.dirname(base)) {
    bases.unshift(base);
    if (base === "/workspace") break;
  }
  const rules: { base: string; matcher: Ignore }[] = [];
  for (const base of bases) {
    try {
      const contents = await service.readFile(
        workspace,
        posix.join(base, ".gitignore"),
      );
      rules.push({ base, matcher: ignore().add(contents) });
    } catch {
      // Missing or symlinked ignore files do not supply rules.
    }
  }
  return {
    ignores(name: string, isDirectory = false): boolean {
      if (name.split("/").some((part) => EXCLUDED_NAMES.has(part))) return true;
      const target = posix.join(directory, name);
      let ignored = false;
      for (const { base, matcher } of rules) {
        const relative =
          posix.relative(base, target) + (isDirectory ? "/" : "");
        const result = matcher.test(relative);
        if (result.ignored) ignored = true;
        else if (result.unignored) ignored = false;
      }
      return ignored;
    },
  };
}
