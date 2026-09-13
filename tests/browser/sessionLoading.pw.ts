import { type Page, expect, test } from "@playwright/test";

async function mockApp(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "DELETE")
      throw new Error("Navigation must not delete an unloaded conversation");
    const json =
      path === "/api/sessions"
        ? {
            sessions: ["a", "b"].map((id) => ({
              id,
              preview: `Conversation ${id}`,
              createdAt: 1,
              updatedAt: 1,
            })),
          }
        : path === "/api/models"
          ? {
              defaultModel: "test",
              models: [
                {
                  id: "test",
                  name: "Test",
                  lab: "Test",
                  provider: "ollama",
                  inputCapabilities: ["text", "image"],
                },
              ],
            }
          : path.endsWith("/health")
            ? { connected: true }
            : path === "/api/agents"
              ? { agents: [] }
              : path.startsWith("/api/runs/active/")
                ? { active: false }
                : {};
    await route.fulfill({ json });
  });
}

function stored(id: string, content: string, image = false) {
  return {
    id,
    model: "test",
    history: [
      {
        role: "user",
        content,
        ...(image
          ? {
              attachments: [
                {
                  id: "image",
                  kind: "image",
                  name: "Pasted image",
                  mimeType: "image/png",
                  size: 10,
                },
              ],
            }
          : {}),
      },
    ],
  };
}

test("session loading displays history and permits navigation while run status and images are held", async ({
  page,
}) => {
  await mockApp(page);
  const status = Promise.withResolvers<void>();
  const images = Promise.withResolvers<void>();
  let statusCompleted = false;
  let imageStarted = false;
  const sessions: string[] = [];
  await page.route("**/api/sessions/*", async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1)!;
    sessions.push(id);
    await route.fulfill({ json: stored(id, `Stored text ${id}`, true) });
  });
  await page.route("**/api/runs/active/*", async (route) => {
    await status.promise;
    await route.fulfill({ json: { active: false } });
    statusCompleted = true;
  });
  await page.route("**/api/attachments/*", async (route) => {
    imageStarted = true;
    await images.promise;
    await route.abort();
  });
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: /Conversation a/ })
      .first()
      .click();
    await expect(
      page.getByText("Stored text a", { exact: true }),
    ).toBeVisible();
    await expect.poll(() => imageStarted).toBe(true);
    await page.getByPlaceholder("Send a message...").fill("test");
    await expect(
      page.getByRole("button", { name: "Send message", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: /Conversation b/ })
      .first()
      .click();
    await expect(
      page.getByText("Stored text b", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Stored text a", { exact: true })).toHaveCount(
      0,
    );
    await page.waitForTimeout(3000);
    expect(statusCompleted).toBe(false);
    expect(sessions).toEqual(["a", "b"]);
    await page.getByPlaceholder("Send a message...").fill("test");
    await expect(
      page.getByRole("button", { name: "Send message", exact: true }),
    ).toBeDisabled();
    status.resolve();
    await expect(
      page.getByRole("button", { name: "Send message", exact: true }),
    ).toBeEnabled();
  } finally {
    status.resolve();
    images.resolve();
  }
});

test("session loading distinguishes loading, errors, and loaded empty", async ({
  page,
}) => {
  await mockApp(page);
  const history = Promise.withResolvers<void>();
  let fail = true;
  await page.route("**/api/sessions/a", async (route) => {
    await history.promise;
    await route.fulfill(
      fail
        ? { status: 500, json: { error: "History unavailable" } }
        : { json: { id: "a", history: [], model: "test" } },
    );
  });
  await page.goto("/run/a");
  await expect(
    page.getByText("Loading conversation…", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Start the session with a message below."),
  ).toHaveCount(0);
  history.resolve();
  await expect(
    page.getByText("History unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Start the session with a message below."),
  ).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByText("Start the session with a message below."),
  ).toBeVisible();
});

test("session loading never replaces streamed completion with an older pending snapshot", async ({
  page,
}) => {
  await mockApp(page);
  const oldHistory = Promise.withResolvers<void>();
  let requests = 0;
  await page.route("**/api/sessions/a", async (route) => {
    const initial = ++requests === 1;
    if (initial) await oldHistory.promise;
    await route.fulfill({
      json: stored(
        "a",
        initial ? "Stale snapshot" : "Completed stream history",
      ),
    });
  });
  await page.route("**/api/runs/active/a", (route) =>
    route.fulfill({ json: { active: true, requestId: "run" } }),
  );
  await page.route("**/api/runs/stream/a", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"type":"run_done"}\n\n',
    }),
  );
  try {
    await page.goto("/run/a");
    await expect(
      page.getByText("Completed stream history", { exact: true }),
    ).toBeVisible();
    oldHistory.resolve();
    await expect(
      page.getByText("Loading conversation…", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Completed stream history", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Stale snapshot", { exact: true })).toHaveCount(
      0,
    );
    expect(requests).toBe(2);
  } finally {
    oldHistory.resolve();
  }
});

test("session loading ignores a departed conversation and keeps sending disabled on status failure", async ({
  page,
}) => {
  await mockApp(page);
  const oldHistory = Promise.withResolvers<void>();
  await page.route("**/api/sessions/a", async (route) => {
    await oldHistory.promise;
    await route.fulfill({ json: stored("a", "Departed history") });
  });
  await page.route("**/api/sessions/b", (route) =>
    route.fulfill({ json: stored("b", "Current history") }),
  );
  await page.route("**/api/runs/active/b", (route) =>
    route.fulfill({ status: 503, json: { error: "unavailable" } }),
  );
  try {
    await page.goto("/run/a");
    await expect(
      page.getByText("Loading conversation…", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Conversation b/ })
      .first()
      .click();
    await expect(
      page.getByText("Current history", { exact: true }),
    ).toBeVisible();
    oldHistory.resolve();
    await expect(
      page.getByText("Could not check the active run.", { exact: true }),
    ).toBeVisible();
    await page.getByPlaceholder("Send a message...").fill("test");
    await expect(
      page.getByRole("button", { name: "Send message", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText("Departed history", { exact: true }),
    ).toHaveCount(0);
  } finally {
    oldHistory.resolve();
  }
});
