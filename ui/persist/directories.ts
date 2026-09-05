import { readApiError } from "../lib/readApiError";
import { userScopedFetch } from "./userIdentity";

export type DirectoryListing = {
  path: string;
  exact: boolean;
  parent: string | null;
  directories: { name: string; path: string }[];
};

export async function fetchDirectories(
  path: string,
  signal: AbortSignal,
): Promise<DirectoryListing> {
  const response = await userScopedFetch(
    `/api/directories?path=${encodeURIComponent(path)}`,
    { signal },
  );
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json();
}
