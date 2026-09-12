import type { ModelOption } from "../types";

export type ModelProvider = {
  id: string;
  name: string;
  iconUrl?: string;
  models: ModelOption[];
};

// Icon filenames published on https://openrouter.ai/providers.
const providerIcons: Record<string, string> = {
  openai: "OpenAI.svg",
  anthropic: "Anthropic.svg",
  google: "GoogleAIStudio.svg",
  deepseek: "DeepSeek.png",
  mistralai: "Mistral.png",
  cohere: "Cohere.png",
  perplexity: "Perplexity.svg",
  inception: "Inception.svg",
};

export function groupModelProviders(models: ModelOption[]): ModelProvider[] {
  const groups = new Map<string, ModelProvider>();
  for (const model of models) {
    const name =
      model.provider === "ollama" ? "Ollama" : model.lab.trim() || "OpenRouter";
    const id = `${model.provider}:${name.toLowerCase()}`;
    let group = groups.get(id);
    if (!group) {
      const route = model.route ?? model.id.replace(/^openrouter:/, "");
      const icon =
        model.provider === "openrouter"
          ? providerIcons[route.replace(/^~/, "").split("/")[0] ?? ""]
          : undefined;
      group = {
        id,
        name,
        iconUrl:
          model.provider === "ollama"
            ? "/icons/ollama.svg"
            : icon
              ? `https://openrouter.ai/images/icons/${icon}`
              : undefined,
        models: [],
      };
      groups.set(id, group);
    }
    group.models.push(model);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
