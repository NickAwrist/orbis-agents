import { execFile as execFileCb } from "node:child_process";
import { dirname } from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);
const PICK_TIMEOUT_MS = 120_000;

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
