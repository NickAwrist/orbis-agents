import { createBrowserUuid } from "../../persist/userIdentity";
import type { UserSettings } from "../../persist/userSettings";

/** Model for new runs: Settings default, else server default (not the active session's model). */
export function effectiveDefaultRunModel(
  settings: UserSettings,
  serverDefault: string,
): string {
  const u = settings.defaultModel.trim();
  return u || serverDefault;
}

export function newEphemeralSessionId(): string {
  return createBrowserUuid();
}
