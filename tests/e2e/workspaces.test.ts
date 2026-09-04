import "../setup";
import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getSessionById, patchSessionRow } from "../../src/db";
import { workspaceService } from "../../src/workspaces/WorkspaceService";
import { TEST_USER_ID, startTestServer, userHeaders } from "../helpers/server";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

async function createSession(url: string): Promise<string> {
  const response = await fetch(`${url}/api/sessions`, {
    method: "POST",
    headers: userHeaders(undefined, { "Content-Type": "application/json" }),
    body: "{}",
  });
  expect(response.status).toBe(201);
  return String(((await response.json()) as { id: string }).id);
}

describe("workspace API", () => {
  test("creates a private server-owned workspace and ignores path patches", async () => {
    const { url, close } = await startTestServer();
    try {
      const sessionId = await createSession(url);
      const row = getSessionById(TEST_USER_ID, sessionId);
      expect(row).not.toBeNull();
      const workspace = await workspaceService.resolveSession(row!);
      expect(workspace.kind).toBe("sandbox");
      expect(workspace.hostPath).toContain(
        `/workspaces/${TEST_USER_ID}/${sessionId}`,
      );

      const patch = await fetch(`${url}/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: userHeaders(undefined, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          sessionDirectory: "/tmp",
          workspaceKind: "local",
        }),
      });
      expect(patch.status).toBe(200);

      const stored = await fetch(`${url}/api/sessions/${sessionId}`, {
        headers: userHeaders(),
      });
      expect(await stored.json()).toMatchObject({
        workspace: { kind: "sandbox" },
      });
    } finally {
      await close();
    }
  });

  test("deleting a local-workspace chat leaves the directory untouched", async () => {
    const { url, close } = await startTestServer();
    const localDirectory = await fs.mkdtemp(
      join(tmpdir(), "orbis-local-delete-test-"),
    );
    temporaryDirectories.push(localDirectory);
    const localFile = join(localDirectory, "keep.txt");
    await fs.writeFile(localFile, "keep");
    try {
      const sessionId = await createSession(url);
      patchSessionRow(TEST_USER_ID, sessionId, {
        workspace_kind: "local",
        session_directory: localDirectory,
      });

      const response = await fetch(`${url}/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: userHeaders(),
      });
      expect(response.status).toBe(200);
      expect(await fs.readFile(localFile, "utf8")).toBe("keep");
    } finally {
      await close();
    }
  });

  test("temporary workspace leases are owner scoped", async () => {
    const { url, close } = await startTestServer();
    try {
      const created = await fetch(`${url}/api/temporary-sessions`, {
        method: "POST",
        headers: userHeaders(),
      });
      expect(created.status).toBe(201);
      const { id } = (await created.json()) as { id: string };

      const ownFiles = await fetch(
        `${url}/api/temporary-sessions/${id}/files`,
        {
          headers: userHeaders(),
        },
      );
      expect(ownFiles.status).toBe(200);
      expect(await ownFiles.json()).toEqual({ files: [] });

      const otherFiles = await fetch(
        `${url}/api/temporary-sessions/${id}/files`,
        { headers: userHeaders("22222222-2222-4222-8222-222222222222") },
      );
      expect(otherFiles.status).toBe(400);
    } finally {
      await close();
    }
  });
});
