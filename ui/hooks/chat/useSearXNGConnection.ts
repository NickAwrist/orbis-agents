import { useCallback, useEffect, useState } from "react";

type SearXNGConfigJson = {
  host?: string;
};

export function useSearXNGConnection() {
  const [searxngHost, setSearxngHost] = useState("");
  const [searxngConnected, setSearxngConnected] = useState<boolean | null>(
    null,
  );

  const fetchSearXNGHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/searxng/health");
      const data = (await res.json().catch(() => ({}))) as {
        connected?: boolean;
      };
      setSearxngConnected(data.connected === true);
    } catch {
      setSearxngConnected(false);
    }
  }, []);

  const applySearXNGConfigResponse = useCallback((data: SearXNGConfigJson) => {
    if (typeof data.host === "string") setSearxngHost(data.host);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/searxng/config");
        const data = (await res.json().catch(() => ({}))) as SearXNGConfigJson;
        if (cancelled) return;
        applySearXNGConfigResponse(data);
      } catch {
        /* ignore */
      }
      void fetchSearXNGHealth();
    })();
    return () => {
      cancelled = true;
    };
  }, [applySearXNGConfigResponse, fetchSearXNGHealth]);

  return {
    searxngHost,
    searxngConnected,
    fetchSearXNGHealth,
    applySearXNGConfigResponse,
  };
}
