import { readApiError } from "../lib/readApiError";
import type {
  Message,
  SessionSummary,
  SessionWorkspace,
  WorkspaceFile,
} from "../types";
import { userScopedFetch } from "./userIdentity";

export type StoredRunSession = {
  id: string;
  createdAt: number;
  updatedAt: number;
  customTitle?: string | null;
  history: Message[];
  modelMessages?: Array<Record<string, unknown>> | null;
  model?: string | null;
  workspace?: SessionWorkspace;
};

export async function fetchSessionSummaries(): Promise<SessionSummary[]> {
  const res = await userScopedFetch("/api/sessions");
  if (!res.ok) throw new Error(await readApiError(res));
  const data = (await res.json()) as { sessions?: unknown };
  const raw = Array.isArray(data.sessions) ? data.sessions : [];
  return raw
    .filter(
      (s): s is Record<string, unknown> => s != null && typeof s === "object",
    )
    .map((s) => ({
      id: String(s.id ?? ""),
      createdAt: Number(s.createdAt) || 0,
      updatedAt: Number(s.updatedAt) || 0,
      preview: String(s.preview ?? "New chat"),
    }))
    .filter((s) => s.id.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function fetchSession(
  id: string,
): Promise<StoredRunSession | null> {
  const res = await userScopedFetch(`/api/sessions/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readApiError(res));
  const s = (await res.json()) as Record<string, unknown>;
  return {
    id: String(s.id ?? ""),
    createdAt: Number(s.createdAt) || 0,
    updatedAt: Number(s.updatedAt) || 0,
    customTitle: s.customTitle == null ? null : String(s.customTitle),
    history: Array.isArray(s.history) ? (s.history as Message[]) : [],
    modelMessages:
      s.modelMessages === null || s.modelMessages === undefined
        ? null
        : Array.isArray(s.modelMessages)
          ? (s.modelMessages as Array<Record<string, unknown>>)
          : null,
    model: s.model == null ? null : String(s.model),
    workspace:
      s.workspace &&
      typeof s.workspace === "object" &&
      (s.workspace as { kind?: unknown }).kind === "local"
        ? {
            kind: "local",
            path: String((s.workspace as { path?: unknown }).path ?? ""),
            label: String((s.workspace as { label?: unknown }).label ?? ""),
          }
        : { kind: "sandbox" },
  };
}

export async function createSessionApi(opts?: {
  model?: string | null;
}): Promise<{
  id: string;
  createdAt: number;
  updatedAt: number;
}> {
  const body: Record<string, string> = {};
  if (opts?.model?.trim()) body.model = opts.model.trim();
  const res = await userScopedFetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  const j = (await res.json()) as Record<string, unknown>;
  return {
    id: String(j.id ?? ""),
    createdAt: Number(j.createdAt) || Date.now(),
    updatedAt: Number(j.updatedAt) || Date.now(),
  };
}

export async function patchSessionApi(
  id: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await userScopedFetch(`/api/sessions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
}

export async function deleteSessionApi(id: string): Promise<void> {
  const res = await userScopedFetch(`/api/sessions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) throw new Error(await readApiError(res));
}

export async function selectSessionDirectory(
  id: string,
  temporary = false,
): Promise<SessionWorkspace | null> {
  const base = temporary ? "/api/temporary-sessions" : "/api/sessions";
  const res = await userScopedFetch(
    `${base}/${encodeURIComponent(id)}/workspace/select-directory`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(await readApiError(res));
  const data = (await res.json()) as {
    workspace?: SessionWorkspace;
    cancelled?: boolean;
  };
  return data.cancelled ? null : (data.workspace ?? null);
}

export async function useSessionSandbox(
  id: string,
  temporary = false,
): Promise<SessionWorkspace> {
  const base = temporary ? "/api/temporary-sessions" : "/api/sessions";
  const res = await userScopedFetch(
    `${base}/${encodeURIComponent(id)}/workspace/use-sandbox`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(await readApiError(res));
  return { kind: "sandbox" };
}

export async function fetchWorkspaceFiles(
  id: string,
  temporary = false,
): Promise<WorkspaceFile[]> {
  const path = temporary
    ? `/api/temporary-sessions/${encodeURIComponent(id)}/files`
    : `/api/sessions/${encodeURIComponent(id)}/workspace/files`;
  const res = await userScopedFetch(path);
  if (!res.ok) throw new Error(await readApiError(res));
  const data = (await res.json()) as { files?: WorkspaceFile[] };
  return Array.isArray(data.files) ? data.files : [];
}

export async function createTemporarySessionApi(): Promise<{ id: string }> {
  const res = await userScopedFetch("/api/temporary-sessions", {
    method: "POST",
  });
  if (!res.ok) throw new Error(await readApiError(res));
  const data = (await res.json()) as { id?: unknown };
  return { id: String(data.id ?? "") };
}

export async function deleteTemporarySessionApi(id: string): Promise<void> {
  const res = await userScopedFetch(
    `/api/temporary-sessions/${encodeURIComponent(id)}`,
    { method: "DELETE", keepalive: true },
  );
  if (!res.ok && res.status !== 404) throw new Error(await readApiError(res));
}
