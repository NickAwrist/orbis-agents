import { describe, expect, test } from "bun:test";
import { reconcilePersistentRun } from "../../ui/hooks/run/reconcilePersistentRun";
import type { StoredRunSession } from "../../ui/persist/sessions";

const completedSession: StoredRunSession = {
  id: "session-1",
  createdAt: 1,
  updatedAt: 2,
  history: [
    { role: "user", content: "Question" },
    { role: "assistant", content: "Completed answer" },
  ],
  modelMessages: [],
};

describe("persistent run resume reconciliation", () => {
  test("keeps a live local stream attached when the server is still active", async () => {
    let reconnected = false;
    let completed = false;
    const result = await reconcilePersistentRun({
      sessionId: "session-1",
      isCurrentSession: () => true,
      isLocallyPending: () => true,
      fetchStatus: async () => ({ active: true, requestId: "request-1" }),
      fetchStoredSession: async () => completedSession,
      onReconnect: () => {
        reconnected = true;
      },
      onCompleted: () => {
        completed = true;
      },
    });

    expect(result).toBe("active");
    expect(reconnected).toBeFalse();
    expect(completed).toBeFalse();
  });

  test("reattaches a dropped local stream when the server is still active", async () => {
    let requestId = "";
    const result = await reconcilePersistentRun({
      sessionId: "session-1",
      isCurrentSession: () => true,
      isLocallyPending: () => false,
      fetchStatus: async () => ({ active: true, requestId: "request-1" }),
      fetchStoredSession: async () => completedSession,
      onReconnect: (nextRequestId) => {
        requestId = nextRequestId;
      },
      onCompleted: () => {},
    });

    expect(result).toBe("reconnected");
    expect(requestId).toBe("request-1");
  });

  test("hydrates completion and clears stale streaming state after the server finishes", async () => {
    let renderedHistory = "";
    let thinking = "Thinking";
    const result = await reconcilePersistentRun({
      sessionId: "session-1",
      isCurrentSession: () => true,
      isLocallyPending: () => true,
      fetchStatus: async () => ({ active: false }),
      fetchStoredSession: async () => completedSession,
      onReconnect: () => {},
      onCompleted: (session) => {
        renderedHistory = session?.history.at(-1)?.content ?? "";
        thinking = "";
      },
    });

    expect(result).toBe("completed");
    expect(renderedHistory).toBe("Completed answer");
    expect(thinking).toBe("");
  });
});
