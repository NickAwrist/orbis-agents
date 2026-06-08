import type { Message } from "../../types";

/** Wired from useRunApp so loadSession can restore mid-flight UI when returning to that session. */
export type RunFlightApi = {
  shouldPreserveMessages: (sessionId: string) => boolean;
  getTurnSnapshot: () => Message[] | null;
  hydrateStreaming: () => void;
  reconnectToStream: (sessionId: string, requestId: string) => void;
};
