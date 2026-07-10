import { useCallback, useEffect, useState } from "react";
import { readApiError } from "../../lib/readApiError";
import type { ModelOption } from "../../types";
import { OLLAMA_HEALTH_POLL_MS } from "./constants";

export function useOllamaConnection() {
  const [ollamaModels, setOllamaModels] = useState<ModelOption[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
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

  const refreshOllamaModels = useCallback(async () => {
    try {
      const res = await fetch("/api/models");
      if (!res.ok) {
        setModelsLoadError(await readApiError(res));
        setOllamaModels([]);
        setCatalogLoaded(true);
        return;
      }
      const data = (await res.json()) as {
        models?: unknown;
        defaultModel?: string;
      };
      setModelsLoadError(null);
      const raw = Array.isArray(data.models) ? data.models : [];
      const list: ModelOption[] = raw
        .filter(
          (m): m is Record<string, unknown> =>
            m != null && typeof m === "object",
        )
        .filter(
          (
            m,
          ): m is Record<string, unknown> & {
            id: string;
            name: string;
            provider: "ollama" | "openrouter";
            lab: string;
          } =>
            typeof m.id === "string" &&
            typeof m.name === "string" &&
            (m.provider === "ollama" || m.provider === "openrouter") &&
            typeof m.lab === "string",
        )
        .map((m) => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          lab: m.lab,
          ...(typeof m.route === "string" ? { route: m.route } : {}),
          ...(typeof m.configured === "boolean"
            ? { configured: m.configured }
            : {}),
        }));
      setOllamaModels(list);
      setCatalogLoaded(true);
      if (typeof data.defaultModel === "string" && data.defaultModel.trim()) {
        setServerDefaultModel(data.defaultModel.trim());
      }
    } catch (e) {
      setModelsLoadError(e instanceof Error ? e.message : String(e));
      setOllamaModels([]);
      setCatalogLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refreshOllamaModels();
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
    catalogLoaded,
    modelsLoadError,
    serverDefaultModel,
    ollamaHost,
    setOllamaHost,
    ollamaConnected,
    fetchOllamaHealth,
    refreshOllamaModels,
    ollamaReady,
  };
}
