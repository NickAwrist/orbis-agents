import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { SearXNGClient } from "../../src/searxng/client";

const restoreFetch: Array<() => void> = [];
afterEach(() => {
  for (const restore of restoreFetch.splice(0)) restore();
});

function respond(...responses: Response[]) {
  const fetch = spyOn(globalThis, "fetch").mockRejectedValue(
    new Error("Unexpected extra search request"),
  );
  for (const response of responses) fetch.mockResolvedValueOnce(response);
  restoreFetch.push(() => fetch.mockRestore());
  return fetch;
}

const client = new SearXNGClient("http://search.test");
const result = {
  title: "Science fiction movies",
  url: "https://example.com/movies",
  content: "Movie rankings",
  engine: "google",
};
const html = (body: string) =>
  new Response(`<meta name="endpoint" content="results">${body}`, {
    headers: { "Content-Type": "text/html" },
  });

describe("SearXNG responses", () => {
  test("returns available results even when another engine fails", async () => {
    respond(
      Response.json({
        results: [null, result],
        unresponsive_engines: [["duckduckgo", "CAPTCHA"]],
      }),
    );
    expect(await client.search("movies", 5)).toEqual([result]);
  });

  test("reports engine failures instead of treating them as no matches", async () => {
    respond(
      Response.json({
        results: [],
        unresponsive_engines: [["brave", "too many requests"]],
      }),
    );
    await expect(client.search("movies", 5)).rejects.toThrow(
      "brave: too many requests",
    );
  });

  test("preserves a legitimate empty result", async () => {
    respond(Response.json({ results: [], unresponsive_engines: [] }));
    expect(await client.search("unmatched query", 5)).toEqual([]);
  });

  test("explains an HTML response from the wrong service", async () => {
    respond(
      new Response("<!doctype html><title>Another app</title>", {
        headers: { "Content-Type": "text/html" },
      }),
    );
    await expect(client.search("movies", 5)).rejects.toThrow(
      "Check the configured SearXNG address",
    );
  });

  test("reports malformed JSON", async () => {
    respond(
      new Response("{", { headers: { "Content-Type": "application/json" } }),
    );
    await expect(client.search("movies", 5)).rejects.toThrow(
      "SearXNG returned invalid JSON",
    );
  });

  test("rejects an unrelated JSON response", async () => {
    respond(Response.json({ status: "ok" }));
    await expect(client.search("movies", 5)).rejects.toThrow(
      "invalid search response",
    );
  });

  test("does not retry rate limited requests as HTML", async () => {
    const fetch = respond(new Response("Rate limited", { status: 429 }));
    await expect(client.search("movies", 5)).rejects.toThrow("HTTP 429");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("retains HTML fallback when JSON is disabled", async () => {
    respond(
      new Response("Forbidden", { status: 403 }),
      html(
        '<article class="result"><h3><a href="https://example.com/movies">Movies</a></h3><p class="content">Rankings</p></article>',
      ),
    );
    expect(await client.search("movies", 5)).toEqual([
      { title: "Movies", url: result.url, content: "Rankings" },
    ]);
  });

  test("extracts failures from an empty HTML search page", async () => {
    respond(
      new Response("Forbidden", { status: 403 }),
      html(
        '<div id="engines_msg"><table><tr><td class="engine-name">duckduckgo</td><td class="response-error">CAPTCHA</td></tr></table></div>',
      ),
    );
    await expect(client.search("movies", 5)).rejects.toThrow(
      "duckduckgo: CAPTCHA",
    );
  });

  test("rejects unrelated HTML in the fallback", async () => {
    respond(
      new Response("Forbidden", { status: 403 }),
      new Response("<title>Login</title>"),
    );
    await expect(client.search("movies", 5)).rejects.toThrow(
      "unexpected HTML page",
    );
  });

  test("does not report an empty test search as healthy", async () => {
    respond(Response.json({ results: [] }));
    expect(await client.healthCheck()).toEqual({
      ok: false,
      error: "SearXNG returned no results for the test query.",
    });
  });
});
