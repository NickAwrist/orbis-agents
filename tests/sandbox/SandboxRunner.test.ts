import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BubblewrapSandboxRunner,
  type SandboxRunner,
} from "../../src/sandbox/SandboxRunner";
import type { Workspace } from "../../src/workspaces/WorkspaceService";

const directories: string[] = [];
const capability = await new BubblewrapSandboxRunner().capability();

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

async function workspace(): Promise<Workspace> {
  const hostPath = await fs.mkdtemp(join(tmpdir(), "orbis-runner-test-"));
  directories.push(hostPath);
  return { kind: "sandbox", hostPath, displayPath: "/workspace" };
}

describe("bubblewrap sandbox runner", () => {
  test.skipIf(capability.available)(
    "fails closed when containment is unavailable",
    async () => {
      const runner: SandboxRunner = new BubblewrapSandboxRunner();

      await expect(
        runner.run({ command: "pwd", workspace: await workspace() }),
      ).rejects.toThrow("Shell tools are disabled");
    },
  );

  test.skipIf(!capability.available)(
    "allows workspace writes but rejects host-system writes",
    async () => {
      const runner = new BubblewrapSandboxRunner();
      const activeWorkspace = await workspace();

      const result = await runner.run({
        command:
          "touch /workspace/inside.txt; touch /usr/orbis-sandbox-escape-test",
        workspace: activeWorkspace,
      });

      expect(
        await fs.readFile(join(activeWorkspace.hostPath, "inside.txt")),
      ).toBeDefined();
      expect(result.exitCode).not.toBe(0);
      await expect(
        fs.access("/usr/orbis-sandbox-escape-test"),
      ).rejects.toThrow();
    },
  );

  test.skipIf(!capability.available)(
    "has no network namespace access",
    async () => {
      const runner = new BubblewrapSandboxRunner();

      const result = await runner.run({
        command:
          "python3 -c \"import socket; socket.create_connection(('1.1.1.1', 53), 0.2)\"",
        workspace: await workspace(),
      });
      expect(result.exitCode).not.toBe(0);
    },
  );
});
