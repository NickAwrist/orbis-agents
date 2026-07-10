import { resolveModelSelection } from "./modelSelection";
import { streamOllamaChat } from "./ollamaProvider";
import { streamOpenRouterChat } from "./openRouterProvider";
import type { LlmChatRequest, LlmChatStream } from "./types";

export async function streamModelChat(
  request: LlmChatRequest,
): Promise<LlmChatStream> {
  const resolved = resolveModelSelection(request.model);
  const providerRequest = { ...request, model: resolved.model };
  return resolved.provider === "openrouter"
    ? streamOpenRouterChat(providerRequest)
    : streamOllamaChat(providerRequest);
}

export { openRouterModelId, resolveModelSelection } from "./modelSelection";
export type { LlmMessage, LlmToolCall } from "./types";
