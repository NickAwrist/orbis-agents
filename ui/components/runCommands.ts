export type RunCommandName = "directory" | "sandbox" | "workspace";

export type RunCommand = {
  name: RunCommandName;
  description: string;
};

export const RUN_COMMANDS: readonly RunCommand[] = [
  {
    name: "directory",
    description: "Allow this chat to work in a folder on the server",
  },
  { name: "sandbox", description: "Return this chat to its private workspace" },
  { name: "workspace", description: "Show files in this chat's workspace" },
];

export function matchingRunCommands(
  input: string,
  workspaceKind: "sandbox" | "local",
): readonly RunCommand[] {
  const trimmed = input.trimStart();
  if (
    !trimmed.startsWith("/") ||
    trimmed.includes(" ") ||
    trimmed.includes("\n")
  ) {
    return [];
  }
  const query = trimmed.slice(1).toLowerCase();
  return RUN_COMMANDS.filter(
    (command) =>
      command.name.startsWith(query) &&
      (command.name !== "sandbox" || workspaceKind === "local"),
  );
}

export function exactRunCommand(input: string): RunCommandName | null {
  const value = input.trim();
  const command = RUN_COMMANDS.find((item) => `/${item.name}` === value);
  return command?.name ?? null;
}
