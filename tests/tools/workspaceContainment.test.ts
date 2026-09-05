import { afterEach, expect, spyOn, test } from "bun:test";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RunContext } from "../../src/RunContext";
import { BaseAgent } from "../../src/agents/BaseAgent";
import { CreateFileTool } from "../../src/tools/create_file";
import { DeleteFileTool } from "../../src/tools/delete_file";
import { GrepTool } from "../../src/tools/grep";
import { ListFilesTool } from "../../src/tools/list_files";
import {
  WorkspaceService,
  workspaceService,
} from "../../src/workspaces/WorkspaceService";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

async function fixture() {
  const root = await fs.mkdtemp(join(tmpdir(), "orbis-tool-race-"));
  roots.push(root);
  const service = new WorkspaceService(root);
  const workspace = await service.provisionRetained("owner", "chat");
  const parent = join(workspace.hostPath, "parent");
  const outside = join(root, "outside");
  await fs.mkdir(parent);
  await fs.mkdir(outside);
  await fs.writeFile(join(parent, "file.txt"), "inside marker");
  await fs.writeFile(join(outside, "file.txt"), "outside secret");
  const ctx = new RunContext(
    new BaseAgent("test", "test"),
    "",
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    "owner",
    workspace,
  );
  return { service, workspace, ctx, parent, outside };
}

for (const operation of ["grep", "create_file", "delete_file"] as const) {
  for (const component of ["file", "parent"] as const) {
    if (operation === "delete_file" && component === "file") continue;
    for (const timing of ["before", "after"] as const) {
      test(`${operation} contains ${component} replacement ${timing} open`, async () => {
        const { ctx, parent, outside } = await fixture();
        const target =
          component === "parent" ? parent : join(parent, "file.txt");
        const replacement =
          component === "parent" ? outside : join(outside, "file.txt");
        const originalOpen = fs.open.bind(fs);
        let replaced = false;
        const swap = async () => {
          replaced = true;
          await fs.rename(target, `${target}.original`);
          await fs.symlink(replacement, target);
        };
        const open = spyOn(fs, "open").mockImplementation(
          async (path, flags, mode) => {
            const replace =
              !replaced &&
              String(path).endsWith(
                component === "parent" ? "/parent" : "/file.txt",
              );
            if (replace && timing === "before") await swap();
            const handle = await originalOpen(path, flags, mode);
            if (replace && timing === "after") await swap();
            return handle;
          },
        );
        try {
          const tool =
            operation === "grep"
              ? new GrepTool()
              : operation === "create_file"
                ? new CreateFileTool()
                : new DeleteFileTool();
          const result = await tool.execute(
            { path: "parent/file.txt", pattern: ".", content: "new output" },
            ctx,
          );
          expect(result.text).not.toContain("outside secret");
          expect(await fs.readFile(join(outside, "file.txt"), "utf8")).toBe(
            "outside secret",
          );
          // unlink uses only a parent descriptor and never opens the final file.
          if (operation !== "delete_file" || component === "parent")
            expect(replaced).toBeTrue();
          if (operation === "create_file" && timing === "after") {
            const written =
              component === "parent"
                ? join(`${parent}.original`, "file.txt")
                : `${target}.original`;
            expect(await fs.readFile(written, "utf8")).toBe("new output");
          }
        } finally {
          open.mockRestore();
        }
      });
    }
  }
}

test("file tools preserve normal create, overwrite, search, ignore and delete behavior", async () => {
  const { ctx, workspace } = await fixture();
  const create = new CreateFileTool();
  expect(
    (
      await create.execute(
        { path: "/workspace/new.txt", content: "long original" },
        ctx,
      )
    ).text,
  ).toContain("File created");
  await create.execute({ path: "new.txt", content: "short" }, ctx);
  expect(await fs.readFile(join(workspace.hostPath, "new.txt"), "utf8")).toBe(
    "short",
  );
  expect(
    (await new GrepTool().execute({ path: ".", pattern: "short" }, ctx)).text,
  ).toContain("new.txt:1: short");
  await fs.writeFile(join(workspace.hostPath, ".gitignore"), "new.txt\n");
  expect((await new ListFilesTool().execute({}, ctx)).text).not.toContain(
    "new.txt",
  );
  expect(
    (await new GrepTool().execute({ path: ".", pattern: "short" }, ctx)).text,
  ).toBe("No matches found.");
  expect(
    (await new DeleteFileTool().execute({ path: "new.txt" }, ctx)).text,
  ).toContain("File deleted");
  await expect(
    fs.access(join(workspace.hostPath, "new.txt")),
  ).rejects.toThrow();
});

test("recursive grep, listing, and scans cannot follow a replaced directory", async () => {
  const { ctx, service, workspace, parent, outside } = await fixture();
  const originalReadDirectory =
    workspaceService.readDirectory.bind(workspaceService);
  let replaced = false;
  const readdir = spyOn(workspaceService, "readDirectory").mockImplementation(
    async (workspace, path) => {
      const entries = await originalReadDirectory(workspace, path);
      if (!replaced) {
        replaced = true;
        await fs.rename(parent, `${parent}.original`);
        await fs.symlink(outside, parent);
      }
      return entries;
    },
  );
  try {
    expect(
      (await new GrepTool().execute({ path: ".", pattern: "." }, ctx)).text,
    ).not.toContain("outside secret");
    expect(
      (await new ListFilesTool().execute({ path: "parent" }, ctx)).text,
    ).toContain("Error:");
    const files = await service.listFiles(workspace);
    expect(files.some((file) => file.path === "parent/file.txt")).toBeFalse();
  } finally {
    readdir.mockRestore();
  }
});

test("symlinked ignore rules are not read", async () => {
  const { ctx, workspace, outside } = await fixture();
  await fs.writeFile(join(outside, ".gitignore"), "parent\n");
  await fs.symlink(
    join(outside, ".gitignore"),
    join(workspace.hostPath, ".gitignore"),
  );
  expect((await new ListFilesTool().execute({}, ctx)).text).toContain(
    "parent/",
  );
});
