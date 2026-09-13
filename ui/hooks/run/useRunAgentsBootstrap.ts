import { useCallback, useEffect, useState } from "react";
import {
  type AgentData,
  fetchAgents,
  fetchDefaultRunAgent,
} from "../../persist/agents";

export function useRunAgentsBootstrap() {
  const [runAgents, setRunAgents] = useState<AgentData[]>([]);
  const [serverDefaultRunAgent, setServerDefaultRunAgent] =
    useState("general_agent");
  const apply = useCallback((list: AgentData[], def: string) => {
    setRunAgents(list);
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
  };
}
