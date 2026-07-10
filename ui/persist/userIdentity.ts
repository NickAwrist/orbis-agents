export const USER_ID_STORAGE_KEY = "orbis:userUuid";
export const USER_ID_HEADER = "X-Orbis-User-ID";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeUserId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

export function getOrCreateUserId(): string {
  const stored = normalizeUserId(localStorage.getItem(USER_ID_STORAGE_KEY));
  if (stored) return stored;
  const created = crypto.randomUUID().toLowerCase();
  localStorage.setItem(USER_ID_STORAGE_KEY, created);
  return created;
}

export function switchUserId(value: string): boolean {
  const normalized = normalizeUserId(value);
  if (!normalized) return false;
  localStorage.setItem(USER_ID_STORAGE_KEY, normalized);
  sessionStorage.removeItem("activeSessionId");
  return true;
}

export function userScopedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set(USER_ID_HEADER, getOrCreateUserId());
  return fetch(input, { ...init, headers });
}
