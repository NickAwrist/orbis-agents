import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { envConfig } from "../../src/env";
import { FetchWebPageTool } from "../../src/tools/fetch_web_page";

const tool = new FetchWebPageTool();
const originalApiKey = envConfig.jinaApiKey;
let fetchMock: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

beforeEach(() => {
  envConfig.jinaApiKey = "";
  fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("# Example\n\nPage content."),
  );
});

afterEach(() => {
  fetchMock.mockRestore();
  envConfig.jinaApiKey = originalApiKey;
});

describe("fetch_web_page", () => {
  test.each([
    undefined,
    42,
    "",
    "   ",
    "example.com",
    "ftp://example.com",
    "file:///etc/passwd",
    "https://",
    "https://invalid host/",
  ])("rejects invalid URL %p without making a request", async (url) => {
    expect((await tool.execute({ url })).text).toContain(
      "Error: url must be a valid HTTP or HTTPS URL",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("does not forward credentials embedded in URLs", async () => {
    expect(
      (await tool.execute({ url: "https://user:password@example.com" })).text,
    ).toContain("URL must not contain credentials");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each(["http", "https"])(
    "returns markdown and preserves encoded %s URLs and query parameters",
    async (protocol) => {
      const url = `${protocol}://example.com/a%20page?q=a%26b&lang=en`;
      expect(await tool.execute({ url: ` ${url} ` })).toEqual({
        text: "# Example\n\nPage content.",
      });
      expect(fetchMock).toHaveBeenCalledWith(`https://r.jina.ai/${url}`, {
        headers: { Accept: "text/plain, text/markdown" },
        signal: expect.any(AbortSignal),
      });
    },
  );

  test("includes the API key when configured", async () => {
    envConfig.jinaApiKey = "test-jina-key";
    await tool.execute({ url: "https://example.com" });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      Accept: "text/plain, text/markdown",
      Authorization: "Bearer test-jina-key",
    });
  });

  test("truncates oversized pages with an explicit notice", async () => {
    fetchMock.mockResolvedValueOnce(new Response("a".repeat(16001)));
    expect((await tool.execute({ url: "https://example.com" })).text).toBe(
      `${"a".repeat(16000)}\n\n[Content truncated to 16000 characters.]`,
    );
  });

  test("does not mark content at the limit as truncated", async () => {
    const content = "a".repeat(16000);
    fetchMock.mockResolvedValueOnce(new Response(content));
    expect((await tool.execute({ url: "https://example.com" })).text).toBe(
      content,
    );
  });

  test.each([401, 429, 500])("reports HTTP %i errors", async (status) => {
    fetchMock.mockResolvedValueOnce(new Response("Failure", { status }));
    expect((await tool.execute({ url: "https://example.com" })).text).toBe(
      `Error fetching web page: Jina Reader returned HTTP ${status}`,
    );
  });

  test.each([
    new Error("Network unavailable"),
    new DOMException("Request timed out", "TimeoutError"),
  ])("returns request failures as tool results: %s", async (error) => {
    fetchMock.mockRejectedValueOnce(error);
    expect((await tool.execute({ url: "https://example.com" })).text).toBe(
      `Error fetching web page: ${error.message}`,
    );
  });

  test("bounds the request with a 15-second timeout", async () => {
    const timeout = spyOn(AbortSignal, "timeout");
    try {
      await tool.execute({ url: "https://example.com" });
      expect(timeout).toHaveBeenCalledWith(15000);
    } finally {
      timeout.mockRestore();
    }
  });
});
