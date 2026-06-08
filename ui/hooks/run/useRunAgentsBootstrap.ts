import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AgentData,
  fetchAgents,
  fetchDefaultRunAgent,
} from "../../persist/agents";

export function useRunAgentsBootstrap() {
  const [runAgents, setRunAgents] = useState<{ name: string }[]>([]);
  const [serverDefaultRunAgent, setServerDefaultRunAgent] =
    useState("general_agent");
  /** Keeps the full agent records (including `system_prompt`) for client-side rendering. */
  const agentMapRef = useRef<Map<string, AgentData>>(new Map());

  const apply = useCallback((list: AgentData[], def: string) => {
    agentMapRef.current = new Map(list.map((a) => [a.name, a]));
    setRunAgents(list.map((a) => ({ name: a.name })));
    setServerDefaultRunAgent(def);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, def] = await Promise.all([
          fetchAgents(),
          fetchDefaultRunAgent(),
        ]);
        if (cancelled) return;
        apply(list, def);
      } catch {
        if (!cancelled) {
          setRunAgents([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const refreshAgentDefaults = useCallback(async () => {
    try {
      const [list, def] = await Promise.all([
        fetchAgents(),
        fetchDefaultRunAgent(),
      ]);
      apply(list, def);
    } catch {
      /* ignore */
    }
  }, [apply]);

  return {
    runAgents,
    serverDefaultRunAgent,
    setServerDefaultRunAgent,
    refreshAgentDefaults,
    agentMapRef,
  };
}
