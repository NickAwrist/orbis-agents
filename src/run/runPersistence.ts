import { type WireMessage, persistSessionMessages } from "../db/index";

/**
 * Persistence boundary for a single run. All calls are no-ops for
 * ephemeral turns, so the caller never has to branch on that itself.
 */
export type RunPersistence = {
  saveInitial(
    history: WireMessage[],
    userMessage: string,
    modelMessages: Array<Record<string, unknown>> | null,
  ): void;
  saveFinal(
    history: WireMessage[],
    modelMessages: Array<Record<string, unknown>> | null,
  ): void;
};

export function createRunPersistence(opts: {
  sessionId: string;
  model: string;
  ephemeral: boolean;
  ownerUuid: string;
}): RunPersistence {
  if (opts.ephemeral) {
    return { saveInitial: () => {}, saveFinal: () => {} };
  }
  const save = (
    history: WireMessage[],
    modelMessages: Array<Record<string, unknown>> | null,
  ) => {
    persistSessionMessages(
      opts.ownerUuid,
      opts.sessionId,
      history,
      modelMessages,
      Date.now(),
      opts.model,
    );
  };
  return {
    saveInitial(history, userMessage, modelMessages) {
      save([...history, { role: "user", content: userMessage }], modelMessages);
    },
    saveFinal(history, modelMessages) {
      save(history, modelMessages);
    },
  };
}
