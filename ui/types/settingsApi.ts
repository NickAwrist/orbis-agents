/** Payload for PUT /api/comfyui/config (and Settings save callback). */
export interface ComfyUIConfigPayload {
  host: string;
  defaultModel: string;
  defaultWidth: number;
  defaultHeight: number;
  negativePrompt: string;
}

/** Payload for PUT /api/searxng/config (and Settings save callback). */
export interface SearXNGConfigPayload {
  host: string;
}
