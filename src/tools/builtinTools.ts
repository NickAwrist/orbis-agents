export const BUILTIN_TOOLS = [
  "create_file",
  "delete_file",
  "grep",
  "list_files",
  "modify_plan",
  "read_file",
  "run_tsc",
  "web_search",
  "bash",
  "generate_image",
] as const;

export function isBuiltinToolName(toolName: string): boolean {
  return (BUILTIN_TOOLS as readonly string[]).includes(toolName);
}
