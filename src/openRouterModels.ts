import {
  InputCapability,
  type InputCapability as InputCapabilityValue,
  parseInputCapabilities,
} from "./modelCapabilities";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

export type OpenRouterModelDetails = {
  route: string;
  name: string;
  ai_lab: string;
  found: boolean;
  inputCapabilities: InputCapabilityValue[];
};

type OpenRouterCatalogModel = {
  id?: unknown;
  name?: unknown;
  architecture?: { input_modalities?: unknown };
};

type OpenRouterModelsResponse = {
  data?: OpenRouterCatalogModel[];
};

function inputCapabilities(value: unknown): InputCapabilityValue[] {
  const parsed = parseInputCapabilities(value);
  return parsed.length > 0 ? parsed : [InputCapability.Text];
}

const LAB_NAMES: Record<string, string> = {
  "aion-labs": "AionLabs",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  google: "Google",
  meta: "Meta",
  "meta-llama": "Meta",
  mistralai: "Mistral AI",
  openai: "OpenAI",
  qwen: "Qwen",
  xai: "xAI",
  "x-ai": "xAI",
};

function titleCase(value: string): string {
  const initials: Record<string, string> = {
    gpt: "GPT",
    llm: "LLM",
    r1: "R1",
  };
  return value
    .split(/[-_.]+/)
    .filter(Boolean)
    .map(
      (part) =>
        initials[part.toLowerCase()] ??
        `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`,
    )
    .join(" ");
}

export function parseOpenRouterRoute(route: string): OpenRouterModelDetails {
  const normalized = route.trim();
  const [rawLab = "", rawModel = ""] = normalized
    .replace(/^~/, "")
    .split("/", 2);
  return {
    route: normalized,
    name: titleCase(rawModel),
    ai_lab: LAB_NAMES[rawLab.toLowerCase()] ?? titleCase(rawLab),
    found: false,
    inputCapabilities: [InputCapability.Text],
  };
}

export async function lookupOpenRouterModel(
  route: string,
): Promise<OpenRouterModelDetails> {
  const fallback = parseOpenRouterRoute(route);
  try {
    const response = await fetch(OPENROUTER_MODELS_URL);
    if (!response.ok) return fallback;
    const payload = (await response.json()) as OpenRouterModelsResponse;
    const match = payload.data?.find((model) => model.id === fallback.route);
    if (!match || typeof match.name !== "string" || !match.name.trim()) {
      return fallback;
    }

    const [labFromName, ...nameParts] = match.name.split(":");
    const lab = labFromName?.trim() ?? "";
    const name = nameParts.join(":").trim();
    return {
      route: fallback.route,
      name: name || match.name.trim(),
      ai_lab: lab || fallback.ai_lab,
      found: true,
      inputCapabilities: inputCapabilities(
        match.architecture?.input_modalities,
      ),
    };
  } catch {
    return fallback;
  }
}

export async function lookupOpenRouterModels(
  routes: string[],
): Promise<Map<string, OpenRouterModelDetails>> {
  const fallbacks = new Map(
    routes.map((route) => [route, parseOpenRouterRoute(route)]),
  );
  try {
    const response = await fetch(OPENROUTER_MODELS_URL);
    if (!response.ok) return fallbacks;
    const payload = (await response.json()) as OpenRouterModelsResponse;
    const byId = new Map(
      (payload.data ?? [])
        .filter(
          (model): model is OpenRouterCatalogModel & { id: string } =>
            typeof model.id === "string",
        )
        .map((model) => [model.id, model]),
    );
    for (const route of routes) {
      const match = byId.get(route);
      if (!match) continue;
      const fallback = fallbacks.get(route)!;
      fallbacks.set(route, {
        ...fallback,
        found: true,
        inputCapabilities: inputCapabilities(
          match.architecture?.input_modalities,
        ),
      });
    }
  } catch {
    // Keep text-only fallbacks when the remote catalog is unavailable.
  }
  return fallbacks;
}
