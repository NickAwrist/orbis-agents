import crypto from "node:crypto";
import { constants, existsSync, mkdirSync, statSync } from "node:fs";
import fs from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { DATA_ROOT } from "../db/constants";
import type { SessionRow } from "../db/types";

export type WorkspaceKind = "sandbox" | "local";

export type Workspace = {
  kind: WorkspaceKind;
  hostPath: string;
  displayPath: string;
};

export type SessionWorkspace =
  | { kind: "sandbox" }
  | { kind: "local"; path: string; label: string };

export type WorkspaceFile = {
  path: string;
  name: string;
  size: number;
  modifiedAt: number;
};

type TemporaryWorkspaceLease = {
  id: string;
  ownerUuid: string;
  hostPath: string;
  workspaceKind: WorkspaceKind;
  localPath?: string;
  expiresAt: number;
};

const TEMPORARY_WORKSPACE_TTL_MS = 24 * 60 * 60 * 1000;
const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export class WorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

export class WorkspaceService {
  readonly retainedRoot: string;
  readonly ephemeralRoot: string;
  readonly trashRoot: string;
  private readonly temporaryLeases = new Map<string, TemporaryWorkspaceLease>();
  private readonly activeTurns = new Set<string>();

  constructor(readonly dataRoot = DATA_ROOT) {
    this.retainedRoot = join(dataRoot, "workspaces");
    this.ephemeralRoot = join(dataRoot, "ephemeral-workspaces");
    this.trashRoot = join(dataRoot, "workspace-trash");
    mkdirSync(this.retainedRoot, { recursive: true });
    mkdirSync(this.ephemeralRoot, { recursive: true });
    mkdirSync(this.trashRoot, { recursive: true });
  }

  private cleanupTimer?: ReturnType<typeof setInterval>;

  async initialize(): Promise<void> {
    this.cleanupTimer ??= setInterval(() => {
      void this.cleanupExpired().catch((error) =>
        console.error("Workspace cleanup failed", error),
      );
    }, 60_000);
    this.cleanupTimer.unref();
    await this.cleanupExpired();
  }

  dispose(): void {
    clearInterval(this.cleanupTimer);
    this.cleanupTimer = undefined;
  }

  async cleanupExpired(): Promise<void> {
    for (const lease of this.temporaryLeases.values()) {
      if (
        lease.expiresAt <= Date.now() &&
        !this.isTurnActive(lease.ownerUuid, lease.id)
      ) {
        await this.deleteTemporary(lease.ownerUuid, lease.id);
      }
    }
    await Promise.all([
      this.purgeExpiredDirectories(
        this.ephemeralRoot,
        TEMPORARY_WORKSPACE_TTL_MS,
      ),
      this.purgeExpiredDirectories(this.trashRoot, TRASH_RETENTION_MS),
    ]);
  }

  beginTurn(ownerUuid: string, sessionId: string): (() => void) | null {
    const key = `${ownerUuid}:${sessionId}`;
    if (this.activeTurns.has(key)) return null;
    this.activeTurns.add(key);
    return () => this.activeTurns.delete(key);
  }

  isTurnActive(ownerUuid: string, sessionId: string): boolean {
    return this.activeTurns.has(`${ownerUuid}:${sessionId}`);
  }

  private safeSegment(value: string, field: string): string {
    if (!SAFE_SEGMENT.test(value)) {
      throw new WorkspaceError(`Invalid ${field}`);
    }
    return value;
  }

  retainedPath(ownerUuid: string, sessionId: string): string {
    return join(
      this.retainedRoot,
      this.safeSegment(ownerUuid, "workspace owner"),
      this.safeSegment(sessionId, "session id"),
    );
  }

  async provisionRetained(
    ownerUuid: string,
    sessionId: string,
  ): Promise<Workspace> {
    const requestedPath = this.retainedPath(ownerUuid, sessionId);
    await fs.mkdir(requestedPath, { recursive: true });
    const hostPath = await fs.realpath(requestedPath);
    return { kind: "sandbox", hostPath, displayPath: "/workspace" };
  }

  async resolveSession(row: SessionRow): Promise<Workspace> {
    if (row.workspace_kind === "local") {
      if (!row.session_directory?.trim()) {
        throw new WorkspaceError(
          "This chat's local directory is no longer configured",
        );
      }
      const hostPath = await this.canonicalDirectory(row.session_directory);
      return { kind: "local", hostPath, displayPath: "/workspace" };
    }
    return this.provisionRetained(row.owner_uuid, row.id);
  }

  presentation(row: SessionRow): SessionWorkspace {
    if (row.workspace_kind === "local" && row.session_directory?.trim()) {
      return {
        kind: "local",
        path: row.session_directory,
        label: basename(row.session_directory) || row.session_directory,
      };
    }
    return { kind: "sandbox" };
  }

  async canonicalDirectory(path: string): Promise<string> {
    const requested = path.trim();
    if (!requested || !isAbsolute(requested)) {
      throw new WorkspaceError("Selected directory must be an absolute path");
    }
    let canonical: string;
    try {
      canonical = await fs.realpath(requested);
      const stat = await fs.stat(canonical);
      if (!stat.isDirectory())
        throw new WorkspaceError("Selected path is not a directory");
      await fs.access(canonical, constants.R_OK | constants.W_OK);
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      throw new WorkspaceError(
        "Selected directory does not exist or is not accessible",
      );
    }
    return canonical;
  }

  async createTemporary(ownerUuid: string): Promise<TemporaryWorkspaceLease> {
    this.safeSegment(ownerUuid, "workspace owner");
    const id = crypto.randomUUID();
    const requestedPath = join(this.ephemeralRoot, id);
    await fs.mkdir(requestedPath, { recursive: false });
    const hostPath = await fs.realpath(requestedPath);
    const lease = {
      id,
      ownerUuid,
      hostPath,
      workspaceKind: "sandbox" as const,
      expiresAt: Date.now() + TEMPORARY_WORKSPACE_TTL_MS,
    };
    this.temporaryLeases.set(id, lease);
    return lease;
  }

  async resolveTemporary(ownerUuid: string, id: string): Promise<Workspace> {
    const lease = this.getTemporaryLease(ownerUuid, id);
    if (lease.workspaceKind === "local") {
      if (!lease.localPath) {
        throw new WorkspaceError(
          "This temporary chat's local directory is no longer configured",
        );
      }
      const hostPath = await this.canonicalDirectory(lease.localPath);
      return { kind: "local", hostPath, displayPath: "/workspace" };
    }
    await fs.access(lease.hostPath, constants.R_OK | constants.W_OK);
    return {
      kind: "sandbox",
      hostPath: lease.hostPath,
      displayPath: "/workspace",
    };
  }

  temporaryPresentation(ownerUuid: string, id: string): SessionWorkspace {
    const lease = this.getTemporaryLease(ownerUuid, id);
    if (lease.workspaceKind === "local" && lease.localPath) {
      return {
        kind: "local",
        path: lease.localPath,
        label: basename(lease.localPath) || lease.localPath,
      };
    }
    return { kind: "sandbox" };
  }

  async selectTemporaryDirectory(
    ownerUuid: string,
    id: string,
    selectedPath: string,
  ): Promise<SessionWorkspace> {
    const lease = this.getTemporaryLease(ownerUuid, id);
    const path = await this.canonicalDirectory(selectedPath);
    lease.workspaceKind = "local";
    lease.localPath = path;
    return {
      kind: "local",
      path,
      label: basename(path) || path,
    };
  }

  useTemporarySandbox(ownerUuid: string, id: string): SessionWorkspace {
    const lease = this.getTemporaryLease(ownerUuid, id);
    lease.workspaceKind = "sandbox";
    lease.localPath = undefined;
    return { kind: "sandbox" };
  }

  async deleteTemporary(ownerUuid: string, id: string): Promise<boolean> {
    const lease = this.temporaryLeases.get(id);
    if (!lease || lease.ownerUuid !== ownerUuid) return false;
    await fs.rm(lease.hostPath, { recursive: true, force: true });
    this.temporaryLeases.delete(id);
    return true;
  }

  async trashRetained(ownerUuid: string, sessionId: string): Promise<void> {
    const source = this.retainedPath(ownerUuid, sessionId);
    if (!existsSync(source)) return;
    const target = join(
      this.trashRoot,
      `${Date.now()}-${crypto.randomUUID()}-${this.safeSegment(sessionId, "session id")}`,
    );
    await fs.rename(source, target);
  }

  async resolveExistingPath(
    workspace: Workspace,
    requestedPath: string,
  ): Promise<string> {
    const lexical = this.resolveLexical(workspace, requestedPath);
    let canonical: string;
    try {
      canonical = await fs.realpath(lexical);
    } catch {
      throw new WorkspaceError(`Path does not exist: ${requestedPath}`);
    }
    this.assertInside(workspace.hostPath, canonical);
    return canonical;
  }

  async resolveNewFilePath(
    workspace: Workspace,
    requestedPath: string,
  ): Promise<string> {
    const lexical = this.resolveLexical(workspace, requestedPath);
    const canonicalParent = await fs.realpath(dirname(lexical)).catch(() => {
      throw new WorkspaceError(
        `Parent directory does not exist: ${dirname(requestedPath)}`,
      );
    });
    this.assertInside(workspace.hostPath, canonicalParent);
    const target = join(canonicalParent, basename(lexical));
    try {
      const stat = await fs.lstat(target);
      if (stat.isSymbolicLink()) {
        throw new WorkspaceError("Symbolic-link file targets are not allowed");
      }
      const existing = await fs.realpath(target);
      this.assertInside(workspace.hostPath, existing);
      return existing;
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return target;
    }
  }

  async listFiles(workspace: Workspace): Promise<WorkspaceFile[]> {
    const files: WorkspaceFile[] = [];
    await this.walkFiles(workspace, workspace.hostPath, files);
    return files.sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  // Linux procfs gives openat-like access relative to pinned directory handles.
  // Never reopen a validated pathname: every component is opened with NOFOLLOW.
  async openFile(
    workspace: Workspace,
    requestedPath: string,
  ): Promise<fs.FileHandle> {
    if (process.platform !== "linux") {
      throw new WorkspaceError("Secure workspace file access requires Linux");
    }
    const target = this.resolveLexical(workspace, requestedPath);
    const parts = relative(workspace.hostPath, target)
      .split("/")
      .filter(Boolean);
    if (!parts.length) throw new WorkspaceError("Requested path is not a file");
    let directory = await fs.open(
      workspace.hostPath,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      for (const part of parts.slice(0, -1)) {
        const next = await fs.open(
          `/proc/self/fd/${directory.fd}/${part}`,
          constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
        );
        await directory.close();
        directory = next;
      }
      const file = await fs.open(
        `/proc/self/fd/${directory.fd}/${parts.at(-1)}`,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        if (!(await file.stat()).isFile())
          throw new WorkspaceError("Requested path is not a file");
        return file;
      } catch (error) {
        await file.close();
        throw error;
      }
    } finally {
      await directory.close();
    }
  }

  private resolveLexical(workspace: Workspace, requestedPath: string): string {
    const requested = requestedPath.trim();
    if (!requested) throw new WorkspaceError("A path is required");
    if (
      isAbsolute(requested) &&
      requested !== "/workspace" &&
      !requested.startsWith("/workspace/")
    ) {
      throw new WorkspaceError(
        "Absolute tool paths must start with /workspace",
      );
    }
    const target = resolve(
      workspace.hostPath,
      isAbsolute(requested)
        ? requested.slice("/workspace".length + 1)
        : requested,
    );
    this.assertInside(workspace.hostPath, target);
    return target;
  }

  private assertInside(root: string, target: string): void {
    const rel = relative(resolve(root), resolve(target));
    if (rel === ".." || rel.startsWith("../") || isAbsolute(rel)) {
      throw new WorkspaceError("Path escapes the active workspace");
    }
  }

  private getTemporaryLease(
    ownerUuid: string,
    id: string,
  ): TemporaryWorkspaceLease {
    const lease = this.temporaryLeases.get(id);
    if (
      !lease ||
      lease.ownerUuid !== ownerUuid ||
      lease.expiresAt <= Date.now()
    ) {
      throw new WorkspaceError("Temporary chat expired or was not found");
    }
    return lease;
  }

  private async walkFiles(
    workspace: Workspace,
    directory: string,
    output: WorkspaceFile[],
  ): Promise<void> {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await this.walkFiles(workspace, fullPath, output);
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        output.push({
          path: relative(workspace.hostPath, fullPath).split("\\").join("/"),
          name: entry.name,
          size: stat.size,
          modifiedAt: stat.mtimeMs,
        });
      }
    }
  }

  private async purgeExpiredDirectories(
    root: string,
    ttlMs: number,
  ): Promise<void> {
    const now = Date.now();
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (root === this.ephemeralRoot && this.temporaryLeases.has(entry.name))
        continue;
      const path = join(root, entry.name);
      try {
        const stat = statSync(path);
        if (now - stat.mtimeMs > ttlMs) {
          await fs.rm(path, { recursive: true, force: true });
        }
      } catch {
        // Best-effort retention cleanup must not block startup.
      }
    }
  }
}

export const workspaceService = new WorkspaceService();
