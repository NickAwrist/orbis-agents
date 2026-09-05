import fs from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { Router } from "express";
import { sendApiError } from "../http/errors";
import { requireUserId } from "../userIdentity";

const router = Router();

router.get("/", async (req, res) => {
  if (!requireUserId(req, res)) return;
  if (req.query.path !== undefined && typeof req.query.path !== "string") {
    sendApiError(
      res,
      400,
      "BAD_REQUEST",
      "Enter an absolute folder path on the server",
    );
    return;
  }
  const input = (req.query.path ?? "").trim();
  const expanded =
    input === "~" || input.startsWith("~/")
      ? join(homedir(), input.slice(1))
      : input || homedir();
  if (!isAbsolute(expanded) || expanded.includes("\0")) {
    sendApiError(
      res,
      400,
      "BAD_REQUEST",
      "Enter an absolute folder path on the server",
    );
    return;
  }
  try {
    let path = resolve(expanded);
    let prefix = "";
    try {
      if (!(await fs.stat(path)).isDirectory()) {
        sendApiError(
          res,
          400,
          "BAD_REQUEST",
          "Selected path is not a directory",
        );
        return;
      }
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ENOENT"
      )
        throw error;
      prefix = basename(path).toLocaleLowerCase();
      path = dirname(path);
    }
    path = await fs.realpath(path);
    const entries = await fs.readdir(path, { withFileTypes: true });
    const directories = (
      await Promise.all(
        entries.map(async (entry) => {
          if (!entry.name.toLocaleLowerCase().startsWith(prefix)) return null;
          const childPath = join(path, entry.name);
          const directory =
            entry.isDirectory() ||
            (entry.isSymbolicLink() &&
              (await fs.stat(childPath).then(
                (stat) => stat.isDirectory(),
                () => false,
              )));
          return directory ? { name: entry.name, path: childPath } : null;
        }),
      )
    )
      .filter((entry) => entry !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({
      path,
      exact: prefix === "",
      parent: dirname(path) === path ? null : dirname(path),
      directories,
    });
  } catch {
    sendApiError(
      res,
      400,
      "BAD_REQUEST",
      "Could not browse this directory. Check that it exists and is accessible.",
    );
  }
});

export default router;
