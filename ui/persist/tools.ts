import { readApiError } from "../lib/readApiError";

export type ShellCapability = {
  available: boolean;
  diagnostic?: string;
};

export async function fetchShellCapability(): Promise<ShellCapability> {
  const response = await fetch("/api/tools");
  if (!response.ok) {
    throw new Error(
      await readApiError(response, "Failed to check shell containment"),
    );
  }
  const body = (await response.json()) as {
    capabilities?: { shell?: ShellCapability };
  };
  return (
    body.capabilities?.shell ?? {
      available: false,
      diagnostic: "Shell containment status is unavailable",
    }
  );
}
