import { useCallback, useEffect, useState } from "react";
import { readApiError } from "../../lib/readApiError";
import type { OllamaModelOption } from "../../types";
import { OLLAMA_HEALTH_POLL_MS } from "./constants";

export function useOllamaConnection() {
  const [ollamaModels, setOllamaModels] = useState<OllamaModelOption[]>([]);
  const [modelsLoadError, setModelsLoadError] = useState<string | null>(null);
  const [serverDefaultModel, setServerDefaultModel] = useState("gemma4:e4b");
  const [ollamaHost, setOllamaHost] = useState("");
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);

  const fetchOllamaHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/ollama/health");
      const data = (await res.json().catch(() => ({}))) as {
        connected?: boolean;
      };
      if (!res.ok) {
        setOllamaConnected(false);
        return;
      }
      setOllamaConnected(data.connected === true);
    } catch {
      setOllamaConnected(false);
    }
  }, []);

  useEffect(() => {
    void fetchOllamaHealth();
    const id = window.setInterval(
      () => void fetchOllamaHealth(),
      OLLAMA_HEALTH_POLL_MS,
    );
    return () => window.clearInterval(id);
  }, [fetchOllamaHealth]);

  const ollamaReady = ollamaConnected === true;
  const ollamaSendReady = ollamaReady && ollamaModels.length > 0;
  const ollamaDisconnected = ollamaConnected === false;

  const refreshOllamaModels = useCallback(async () => {
    try {
      const res = await fetch("/api/models");
      if (!res.ok) {
        setModelsLoadError(await readApiError(res));
        setOllamaModels([]);
        return;
      }
      const data = (await res.json()) as {
        models?: unknown;
        defaultModel?: string;
      };
      setModelsLoadError(null);
      const raw = Array.isArray(data.models) ? data.models : [];
      const list: OllamaModelOption[] = raw
        .filter(
          (m): m is Record<string, unknown> =>
            m != null && typeof m === "object",
        )
        .map((m) => m.name)
        .filter((n): n is string => typeof n === "string" && n.length > 0)
        .map((name) => ({ name }));
      setOllamaModels(list);
      if (typeof data.defaultModel === "string" && data.defaultModel.trim()) {
        setServerDefaultModel(data.defaultModel.trim());
      }
    } catch (e) {
      setModelsLoadError(e instanceof Error ? e.message : String(e));
      setOllamaModels([]);
    }
  }, []);

  useEffect(() => {
    if (ollamaConnected === true) {
      void refreshOllamaModels();
      return;
    }
    if (ollamaConnected === false) {
      setOllamaModels([]);
      setModelsLoadError(null);
    }
  }, [ollamaConnected, refreshOllamaModels]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ollama/config");
        const data = (await res.json().catch(() => ({}))) as { host?: string };
        if (cancelled) return;
        if (typeof data.host === "string") setOllamaHost(data.host);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    ollamaModels,
    modelsLoadError,
    serverDefaultModel,
    ollamaHost,
    setOllamaHost,
    ollamaConnected,
    fetchOllamaHealth,
    refreshOllamaModels,
    ollamaReady,
    ollamaSendReady,
    ollamaDisconnected,
  };
}
