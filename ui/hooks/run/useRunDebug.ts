import { type MutableRefObject, useCallback } from "react";
import {
  CORE_DIRECTIVES,
  type PromptContext,
  renderSystemPrompt,
} from "../../../src/prompts/render";
import { getClientOs } from "../../lib/clientOs";
import { type AgentData, fetchAgents } from "../../persist/agents";
import { fetchSession } from "../../persist/sessions";
import type { UserSettings } from "../../persist/userSettings";
import type { DebugData } from "../../types";

type Args = {
  agentMapRef: MutableRefObject<Map<string, AgentData>>;
  selectedSessionAgentRef: MutableRefObject<string>;
  workspaceDisplayPath: string;
  userSettingsRef: MutableRefObject<UserSettings>;
  isEphemeralRef: MutableRefObject<boolean>;
  setDebugData: (data: DebugData | null) => void;
};

export function useRunDebug({
  agentMapRef,
  selectedSessionAgentRef,
  workspaceDisplayPath,
  userSettingsRef,
  isEphemeralRef,
  setDebugData,
}: Args) {
  const resolveAgentTemplate = useCallback(async (): Promise<string> => {
    const name = selectedSessionAgentRef.current;
    const cached = agentMapRef.current.get(name);
    if (cached) return cached.system_prompt;

    try {
      const agents = await fetchAgents();
      agentMapRef.current = new Map(agents.map((agent) => [agent.name, agent]));
      return (
        agentMapRef.current.get(name)?.system_prompt ??
        agents[0]?.system_prompt ??
        ""
      );
    } catch {
      return "";
    }
  }, [agentMapRef, selectedSessionAgentRef]);

  const renderCurrentSystemPrompt = useCallback(async (): Promise<string> => {
    const settings = userSettingsRef.current;
    const context: PromptContext = {
      personalization: {
        name: settings.name,
        location: settings.location,
        preferredFormats: settings.preferredFormats,
      },
      sessionDirectory: workspaceDisplayPath,
      os: getClientOs(),
    };
    return renderSystemPrompt(await resolveAgentTemplate(), context);
  }, [resolveAgentTemplate, userSettingsRef, workspaceDisplayPath]);

  return useCallback(
    async (sessionId: string) => {
      try {
        const rendered = await renderCurrentSystemPrompt();
        const systemPrompt = rendered
          ? `${rendered}\n\n${CORE_DIRECTIVES}`
          : CORE_DIRECTIVES;
        const stored = isEphemeralRef.current
          ? null
          : await fetchSession(sessionId);
        setDebugData({
          systemPrompt,
          history: stored?.history ?? [],
          customTitle: stored?.customTitle ?? null,
          modelMessages: stored?.modelMessages,
        });
      } catch (error) {
        console.error("Failed to load debug data", error);
      }
    },
    [isEphemeralRef, renderCurrentSystemPrompt, setDebugData],
  );
}
