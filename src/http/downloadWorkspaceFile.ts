import { basename } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Response } from "express";
import {
  type Workspace,
  workspaceService,
} from "../workspaces/WorkspaceService";

export async function downloadWorkspaceFile(
  res: Response,
  workspace: Workspace,
  requestedPath: string,
): Promise<void> {
  const file = await workspaceService.openFile(workspace, requestedPath);
  try {
    const stat = await file.stat();
    const name = basename(requestedPath).replace(/["\r\n]/g, "_");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    await pipeline(file.createReadStream({ autoClose: false }), res);
  } finally {
    await file.close();
  }
}
