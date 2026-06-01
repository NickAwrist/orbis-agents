import { getComfyUIClient } from "../comfyui/client";
import { getSearXNGClient } from "../searxng/client";

type ToolService = "comfyui" | "searxng";

const status: Record<ToolService, boolean> = {
  comfyui: false,
  searxng: false,
};

export function setToolServiceStatus(
  service: ToolService,
  connected: boolean,
): void {
  status[service] = connected;
}

export function isToolServiceConnected(service: ToolService): boolean {
  return status[service] === true;
}

export function isBuiltinToolEnabled(toolName: string): boolean {
  if (toolName === "generate_image") return isToolServiceConnected("comfyui");
  if (toolName === "web_search") return isToolServiceConnected("searxng");
  return true;
}

export async function refreshToolAvailability(): Promise<void> {
  const [comfy, searxng] = await Promise.all([
    getComfyUIClient().healthCheck(2500),
    getSearXNGClient().healthCheck(3000),
  ]);
  setToolServiceStatus("comfyui", comfy.ok);
  setToolServiceStatus("searxng", searxng.ok);
}
