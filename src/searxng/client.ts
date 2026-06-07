import { parse as parseHtml } from "node-html-parser";
import { getSearXNGHost } from "../db/index";
import { DEFAULT_SEARXNG_HOST } from "../env";
import { providerHostConfig } from "../providerHostConfig";

export type SearXNGResult = {
  title: string;
  url: string;
  content: string;
  engine?: string;
};

type RawSearXNGResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  engine?: unknown;
};

type RawSearXNGResponse = {
  results?: unknown;
};

const REQUEST_HEADERS = {
  Accept: "application/json, text/html;q=0.9",
  "User-Agent": "OrbisAgents/1.0",
  "X-Forwarded-For": "127.0.0.1",
  "X-Real-IP": "127.0.0.1",
};

export class SearXNGClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async search(
    query: string,
    maxResults: number,
    timeoutMs = 10000,
  ): Promise<SearXNGResult[]> {
    const jsonUrl = this.searchUrl(query);
    jsonUrl.searchParams.set("format", "json");
    const jsonResponse = await fetch(jsonUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: REQUEST_HEADERS,
    });

    if (jsonResponse.ok) {
      const data = (await jsonResponse.json()) as RawSearXNGResponse;
      return parseSearXNGJsonResults(data, maxResults);
    }

    const htmlUrl = this.searchUrl(query);
    const htmlResponse = await fetch(htmlUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { ...REQUEST_HEADERS, Accept: "text/html" },
    });

    if (!htmlResponse.ok) {
      throw new Error(
        `SearXNG returned HTTP ${jsonResponse.status}; HTML fallback returned HTTP ${htmlResponse.status}`,
      );
    }

    return parseSearXNGHtmlResults(await htmlResponse.text(), maxResults);
  }

  async healthCheck(
    timeoutMs = 5000,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.search("searxng", 1, timeoutMs);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private searchUrl(query: string): URL {
    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.set("q", query);
    return url;
  }
}

function parseSearXNGJsonResults(
  data: RawSearXNGResponse,
  maxResults: number,
): SearXNGResult[] {
  const rows = Array.isArray(data.results) ? data.results : [];
  const out: SearXNGResult[] = [];

  for (const row of rows) {
    if (out.length >= maxResults) break;
    const result = row as RawSearXNGResult;
    const title = typeof result.title === "string" ? result.title.trim() : "";
    const url = typeof result.url === "string" ? result.url.trim() : "";
    if (!title && !url) continue;
    out.push({
      title: title || url,
      url,
      content:
        typeof result.content === "string" && result.content.trim()
          ? cleanText(result.content)
          : "No description available.",
      engine:
        typeof result.engine === "string" ? result.engine.trim() : undefined,
    });
  }

  return out;
}

function parseSearXNGHtmlResults(
  html: string,
  maxResults: number,
): SearXNGResult[] {
  const root = parseHtml(html);
  const nodes = root.querySelectorAll("article.result");
  const out: SearXNGResult[] = [];

  for (const node of nodes) {
    if (out.length >= maxResults) break;
    const titleAnchor =
      node.querySelector("h3 a") ?? node.querySelector(".url_header");
    const urlAnchor = node.querySelector(".url_header") ?? titleAnchor;
    const title = cleanText(titleAnchor?.text ?? "");
    const url = urlAnchor?.getAttribute("href")?.trim() ?? "";
    if (!title && !url) continue;
    out.push({
      title: title || url,
      url,
      content:
        cleanText(node.querySelector(".content")?.text ?? "") ||
        "No description available.",
    });
  }

  return out;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

let clientInstance: SearXNGClient | null = null;
let cachedHost: string | null = null;

export function getResolvedSearXNGHost(): string {
  return getSearXNGHostConfig().effectiveHost;
}

export function getSearXNGHostConfig(): {
  host: string;
  effectiveHost: string;
} {
  const configuredHost = getSearXNGHost();
  return providerHostConfig({
    host: configuredHost === DEFAULT_SEARXNG_HOST ? "" : configuredHost,
    fallbackHost: DEFAULT_SEARXNG_HOST,
    normalize: (host) => host.replace(/\/+$/, ""),
  });
}

export function getSearXNGClient(): SearXNGClient {
  const host = getResolvedSearXNGHost();
  if (!clientInstance || cachedHost !== host) {
    clientInstance = new SearXNGClient(host);
    cachedHost = host;
  }
  return clientInstance;
}

export function invalidateSearXNGClient(): void {
  clientInstance = null;
  cachedHost = null;
}
