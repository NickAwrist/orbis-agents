import { execFile as execFileCb } from "node:child_process";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

const PICK_TIMEOUT_MS = 120_000;

/** Opens the OS native folder picker (blocking). Returns null if cancelled or unavailable. */
export async function pickFolderNative(): Promise<string | null> {
  const platform = process.platform;
  if (platform === "win32") {
    return pickWindows();
  }
  if (platform === "darwin") {
    return pickMacos();
  }
  return pickLinux();
}

export async function revealFileNative(path: string): Promise<void> {
  if (process.platform === "win32") {
    await execFile("explorer.exe", ["/select,", path], {
      windowsHide: false,
      timeout: PICK_TIMEOUT_MS,
    });
    return;
  }
  if (process.platform === "darwin") {
    await execFile("open", ["-R", path], { timeout: PICK_TIMEOUT_MS });
    return;
  }
  await execFile("xdg-open", [dirname(path)], { timeout: PICK_TIMEOUT_MS });
}

export async function confirmFolderGrantNative(path: string): Promise<boolean> {
  const message = `Allow this chat to read and modify files in "${path}" until you switch back to its private workspace.`;
  try {
    if (process.platform === "win32") {
      const escaped = message.replace(/'/g, "''");
      const script = `Add-Type -AssemblyName System.Windows.Forms; if ([System.Windows.Forms.MessageBox]::Show('${escaped}', 'Allow directory access?', 'YesNo', 'Warning') -eq 'Yes') { exit 0 } else { exit 2 }`;
      await execFile(
        "powershell.exe",
        ["-NoProfile", "-STA", "-Command", script],
        {
          timeout: PICK_TIMEOUT_MS,
        },
      );
      return true;
    }
    if (process.platform === "darwin") {
      const escaped = message.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      await execFile("osascript", [
        "-e",
        `display dialog "${escaped}" with title "Allow directory access?" buttons {"Cancel", "Allow"} default button "Allow" with icon caution`,
      ]);
      return true;
    }
    try {
      await execFile("zenity", [
        "--question",
        "--title=Allow directory access?",
        `--text=${message}`,
        "--ok-label=Allow",
        "--cancel-label=Cancel",
      ]);
      return true;
    } catch {
      await execFile("kdialog", [
        "--warningyesno",
        message,
        "--title",
        "Allow directory access?",
      ]);
      return true;
    }
  } catch {
    return false;
  }
}

async function pickWindows(): Promise<string | null> {
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = "Choose session working directory"
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 2 }
    Write-Output $dialog.SelectedPath
    exit 0
`.trim();

  const scriptPath = join(
    tmpdir(),
    `pick-folder-${process.pid}-${Date.now()}.ps1`,
  );
  await writeFile(scriptPath, script, "utf8");
  try {
    try {
      const { stdout } = await execFile(
        "powershell.exe",
        [
          "-NoProfile",
          "-STA",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          scriptPath,
        ],
        {
          encoding: "utf8",
          windowsHide: false,
          timeout: PICK_TIMEOUT_MS,
          maxBuffer: 1024 * 1024,
        },
      );
      const p = stdout.trim();
      return p.length > 0 ? p : null;
    } catch (e: unknown) {
      const err = e as { status?: number; code?: string | number };
      if (err.status === 2 || err.code === 2) return null;
      throw e;
    }
  } finally {
    await unlink(scriptPath).catch(() => {});
  }
}

async function pickMacos(): Promise<string | null> {
  try {
    const { stdout } = await execFile(
      "osascript",
      [
        "-e",
        'POSIX path of (choose folder with prompt "Choose session working directory")',
      ],
      { encoding: "utf8", timeout: PICK_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
    );
    const p = stdout.trim();
    return p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

async function pickLinux(): Promise<string | null> {
  try {
    const { stdout } = await execFile(
      "zenity",
      ["--file-selection", "--directory", "--title=Session working directory"],
      { encoding: "utf8", timeout: PICK_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
    );
    const p = stdout.trim();
    if (p.length > 0) return p;
  } catch {
    /* missing zenity or cancelled */
  }
  try {
    const { stdout } = await execFile(
      "kdialog",
      ["--getexistingdirectory", "."],
      { encoding: "utf8", timeout: PICK_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
    );
    const p = stdout.trim();
    return p.length > 0 ? p : null;
  } catch {
    return null;
  }
}
