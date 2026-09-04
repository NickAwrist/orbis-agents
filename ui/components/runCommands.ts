export type RunCommandName = "directory" | "sandbox" | "workspace" | "computer";

export type RunCommand = {
  name: RunCommandName;
  description: string;
};

export const RUN_COMMANDS: readonly RunCommand[] = [
  {
    name: "directory",
    description: "Allow this chat to work in a local folder",
  },
  { name: "sandbox", description: "Return this chat to its private workspace" },
  { name: "workspace", description: "Show files in this chat's workspace" },
  { name: "computer", description: "Open computer-use controls" },
];

export function matchingRunCommands(input: string): readonly RunCommand[] {
  const trimmed = input.trimStart();
  if (
    !trimmed.startsWith("/") ||
    trimmed.includes(" ") ||
    trimmed.includes("\n")
  ) {
    return [];
  }
  const query = trimmed.slice(1).toLowerCase();
  return RUN_COMMANDS.filter((command) => command.name.startsWith(query));
}

export function exactRunCommand(input: string): RunCommandName | null {
  const value = input.trim();
  const command = RUN_COMMANDS.find((item) => `/${item.name}` === value);
  return command?.name ?? null;
}
