import type { StoredRunSession } from "../../persist/sessions";

export type PersistentRunStatus = {
  active: boolean;
  requestId?: string;
};

type ReconcilePersistentRunOptions = {
  sessionId: string;
  isCurrentSession: () => boolean;
  isLocallyPending: () => boolean;
  fetchStatus: () => Promise<PersistentRunStatus>;
  fetchStoredSession: () => Promise<StoredRunSession | null>;
  onReconnect: (requestId: string) => void;
  onCompleted: (session: StoredRunSession | null) => void | Promise<void>;
};

export type PersistentRunReconcileResult =
  | "active"
  | "reconnected"
  | "completed"
  | "stale";

/**
 * Reconcile client streaming state with the server after an app resumes.
 * Mobile browsers can suspend an SSE reader before it receives the terminal
 * event, so server status and persisted history are authoritative here.
 */
export async function reconcilePersistentRun(
  options: ReconcilePersistentRunOptions,
): Promise<PersistentRunReconcileResult> {
  const status = await options.fetchStatus();
  if (!options.isCurrentSession()) return "stale";

  if (status.active && status.requestId) {
    if (options.isLocallyPending()) return "active";
    options.onReconnect(status.requestId);
    return "reconnected";
  }

  const session = await options.fetchStoredSession();
  if (!options.isCurrentSession()) return "stale";
  await options.onCompleted(session);
  return "completed";
}
