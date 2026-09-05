import "../setup";
import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, parse } from "node:path";
import { startTestServer, userHeaders } from "../helpers/server";

test("browses server directories and completes partial paths without reading files", async () => {
  const { url, close } = await startTestServer();
  const root = await fs.mkdtemp(join(tmpdir(), "orbis-browse-"));
  const browse = (path: string) =>
    fetch(`${url}/api/directories?path=${encodeURIComponent(path)}`, {
      headers: userHeaders(),
    });
  try {
    await fs.mkdir(join(root, "Desktop"));
    await fs.mkdir(join(root, ".hidden"));
    await fs.writeFile(join(root, "secret.txt"), "not returned");
    await fs.symlink(join(root, "Desktop"), join(root, "linked"));
    await fs.symlink(join(root, "missing"), join(root, "broken"));
    const response = await browse(root);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      path: await fs.realpath(root),
      exact: true,
      parent: dirname(await fs.realpath(root)),
      directories: [".hidden", "Desktop", "linked"].map((name) => ({
        name,
        path: join(root, name),
      })),
    });
    expect(await (await browse(join(root, "des"))).json()).toMatchObject({
      path: root,
      exact: false,
      directories: [{ name: "Desktop", path: join(root, "Desktop") }],
    });
    expect(await (await browse(join(root, "Desktop"))).json()).toMatchObject({
      parent: root,
      exact: true,
      directories: [],
    });
    expect(await (await browse("~")).json()).toMatchObject({
      path: await fs.realpath(homedir()),
      exact: true,
    });
    expect(await (await browse(parse(root).root)).json()).toMatchObject({
      parent: null,
    });
    for (const path of [
      "relative",
      join(root, "secret.txt"),
      join(root, "missing", "nested"),
      "\0",
    ]) {
      expect((await browse(path)).status).toBe(400);
    }
    expect((await fetch(`${url}/api/directories`)).status).toBe(400);
    expect(
      (
        await fetch(`${url}/api/directories?path=a&path=b`, {
          headers: userHeaders(),
        })
      ).status,
    ).toBe(400);
  } finally {
    await close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
