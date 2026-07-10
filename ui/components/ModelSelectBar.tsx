import { ChevronDown } from "lucide-react";
import type { ModelOption } from "../types";

const selectClass =
  "max-w-[min(100%,18rem)] cursor-pointer appearance-none rounded-lg border border-transparent bg-transparent py-1.5 pl-2 pr-8 text-[0.8125rem] font-medium text-foreground outline-none transition-[border-color,background-color,color] duration-150 hover:bg-muted/60 focus-visible:border-border focus-visible:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-45";

export function ModelSelectBar({
  ollamaModels,
  ollamaConnected,
  modelsLoadError,
  selectedModel,
  onModelChange,
  disabled,
}: {
  ollamaModels: ModelOption[];
  ollamaConnected: boolean | null;
  modelsLoadError: string | null;
  selectedModel: string;
  onModelChange: (model: string) => void;
  disabled: boolean;
}) {
  const modelNames = new Set(ollamaModels.map((m) => m.id));
  const showSelectedNotListed = Boolean(
    selectedModel && ollamaModels.length > 0 && !modelNames.has(selectedModel),
  );
  const hasModels = ollamaModels.length > 0;
  const placeholderValue = "__model_status__";
  const statusLabel =
    ollamaConnected === null
      ? "Checking Ollama..."
      : ollamaConnected === false
        ? "Model provider disconnected"
        : modelsLoadError
          ? "Models unavailable"
          : "No models found";

  return (
    <div className="relative min-w-0">
      <label htmlFor="run-model" className="sr-only">
        Model
      </label>
      <select
        id="run-model"
        value={hasModels ? selectedModel : placeholderValue}
        onChange={(e) => onModelChange(e.target.value)}
        disabled={disabled || !hasModels}
        className={selectClass}
        title={modelsLoadError ? modelsLoadError : undefined}
      >
        {!hasModels ? (
          <option value={placeholderValue}>{statusLabel}</option>
        ) : (
          <>
            {showSelectedNotListed && (
              <option value={selectedModel}>{selectedModel} (offline)</option>
            )}
            {(["ollama", "openrouter"] as const).map((provider) => {
              const options = ollamaModels.filter(
                (model) => model.provider === provider,
              );
              if (options.length === 0) return null;
              return (
                <optgroup
                  key={provider}
                  label={
                    provider === "ollama" ? "Ollama (local)" : "OpenRouter"
                  }
                >
                  {options.map((model) => (
                    <option
                      key={model.id}
                      value={model.id}
                      disabled={
                        model.provider === "openrouter" &&
                        model.configured === false
                      }
                    >
                      {model.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </>
        )}
      </select>
      <span
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      >
        <ChevronDown size={12} strokeWidth={1.75} />
      </span>
    </div>
  );
}
