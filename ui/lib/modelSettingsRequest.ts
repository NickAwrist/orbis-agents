import { readApiError } from "./readApiError";

export async function modelSettingsRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api/settings/${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<T>;
}
