import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
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
  test.skipIf(!capability.available || process.getuid?.() !== 0)(
    "runs a local workspace as its owner beneath a private home directory",
    async () => {
      const parent = await fs.mkdtemp(join(tmpdir(), "orbis-private-home-"));
      directories.push(parent);
      const hostPath = join(parent, "project");
      await fs.mkdir(hostPath, { mode: 0o700 });
      await fs.chown(parent, 1000, 1000);
      await fs.chown(hostPath, 1000, 1000);

      const result = await new BubblewrapSandboxRunner().run({
        command: "touch created.txt; id -u",
        workspace: { kind: "local", hostPath, displayPath: "/workspace" },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("1000");
      expect((await fs.stat(join(hostPath, "created.txt"))).uid).toBe(1000);
    },
  );

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

test.skipIf(!capability.available || !existsSync("/etc/alternatives/awk"))(
  "runs alternatives-backed executables inside the sandbox",
  async () => {
    const result = await new BubblewrapSandboxRunner().run({
      command: "awk 'BEGIN { print 42 }'",
      workspace: await workspace(),
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("42");
  },
);
