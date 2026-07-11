import { Check, KeyRound, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { readApiError } from "../../lib/readApiError";
import {
  cx,
  eyebrowText,
  modalCloseButton,
  modalHeader,
  modalShell,
  primaryButton,
  secondaryButton,
} from "../../styles";
import { hintClass, inputClass, labelClass } from "./constants";

type RegistryModel = {
  id: number;
  name: string;
  route: string;
  ai_lab: string;
};

type Lookup = {
  route: string;
  name: string;
  ai_lab: string;
  found: boolean;
};

function openRouterError(cause: unknown, fallback: string): string {
  if (cause instanceof TypeError && cause.message === "Failed to fetch") {
    return fallback;
  }
  return cause instanceof Error ? cause.message : String(cause);
}

export function OpenRouterSettingsTab({
  onModelsChanged,
}: {
  onModelsChanged: () => Promise<void>;
}) {
  const [hasKey, setHasKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [models, setModels] = useState<RegistryModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(false);
  const [adding, setAdding] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [route, setRoute] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const routeInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [keyRes, modelsRes] = await Promise.all([
        fetch("/api/settings/openrouter"),
        fetch("/api/settings/openrouter/models"),
      ]);
      if (!keyRes.ok) throw new Error(await readApiError(keyRes));
      if (!modelsRes.ok) throw new Error(await readApiError(modelsRes));
      const keyData = (await keyRes.json()) as { hasKey?: boolean };
      const modelsData = (await modelsRes.json()) as { models?: unknown };
      setHasKey(keyData.hasKey === true);
      setModels(
        Array.isArray(modelsData.models)
          ? (modelsData.models as RegistryModel[])
          : [],
      );
    } catch (cause) {
      setError(
        openRouterError(
          cause,
          "Could not load OpenRouter settings. Make sure the app server is running and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (modalOpen) routeInputRef.current?.focus();
  }, [modalOpen]);

  const saveApiKey = async (nextKey: string) => {
    setSavingKey(true);
    setKeySaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings/openrouter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: nextKey }),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      const data = (await res.json()) as { hasKey?: boolean };
      setHasKey(data.hasKey === true);
      setApiKey("");
      setKeySaved(true);
      await onModelsChanged();
    } catch (cause) {
      setError(
        openRouterError(cause, "Could not save the OpenRouter API key."),
      );
    } finally {
      setSavingKey(false);
    }
  };

  const lookUpRoute = async () => {
    const trimmed = route.trim();
    if (!trimmed) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/openrouter/models/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: trimmed }),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      setLookup((await res.json()) as Lookup);
    } catch (cause) {
      setError(openRouterError(cause, "Could not look up that model route."));
    } finally {
      setAdding(false);
    }
  };

  const addModel = async () => {
    if (!lookup) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/openrouter/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: lookup.route }),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      const created = (await res.json()) as RegistryModel;
      setModels((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setModalOpen(false);
      setRoute("");
      setLookup(null);
      await onModelsChanged();
    } catch (cause) {
      setError(openRouterError(cause, "Could not add that OpenRouter model."));
    } finally {
      setAdding(false);
    }
  };

  const removeModel = async (model: RegistryModel) => {
    setError(null);
    try {
      const res = await fetch(`/api/settings/openrouter/models/${model.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readApiError(res));
      setModels((current) => current.filter((entry) => entry.id !== model.id));
      await onModelsChanged();
    } catch (cause) {
      setError(
        openRouterError(cause, "Could not remove that OpenRouter model."),
      );
    }
  };

  const openModal = () => {
    setError(null);
    setRoute("");
    setLookup(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <div className="relative">
          <h2 className={cx(eyebrowText, "mb-4")}>OpenRouter</h2>
          <span
            className={cx(
              "absolute right-0 top-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.6875rem] font-medium",
              hasKey
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {hasKey && <Check size={12} />}
            {hasKey ? "Configured" : "Add an API key"}
          </span>
        </div>
        <div className="space-y-2">
          <label htmlFor="openrouterApiKey" className={labelClass}>
            OpenRouter API key
          </label>
          <div className="flex flex-wrap items-stretch gap-2 sm:flex-nowrap">
            <div className="relative min-w-0 flex-1">
              <KeyRound
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="openrouterApiKey"
                type="password"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setKeySaved(false);
                }}
                placeholder={
                  hasKey ? "Enter a replacement key" : "sk-or-v1-..."
                }
                autoComplete="new-password"
                className={cx(inputClass, "min-w-0 flex-1 pl-9")}
              />
            </div>
            <button
              type="button"
              disabled={savingKey || !apiKey.trim()}
              onClick={() => void saveApiKey(apiKey.trim())}
              className={primaryButton}
            >
              {savingKey ? "Saving..." : hasKey ? "Replace key" : "Save key"}
            </button>
            {hasKey && (
              <button
                type="button"
                disabled={savingKey}
                onClick={() => void saveApiKey("")}
                className="rounded-lg border border-border-subtle px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-red-500/30 hover:text-red-400 disabled:opacity-60"
              >
                Remove
              </button>
            )}
          </div>
          {keySaved && (
            <p className={hintClass}>
              Key saved. OpenRouter models are ready to use.
            </p>
          )}
        </div>
      </section>

      <hr className="border-border-subtle" />

      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className={eyebrowText}>Model Registry</h2>
            <p className={cx(hintClass, "mt-2")}>
              Add a route such as <code>anthropic/claude-sonnet-4.6</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={openModal}
            className={cx(primaryButton, "shrink-0 rounded-md")}
          >
            <Plus size={15} />
            Add model
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-border-subtle">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">
              Loading models...
            </p>
          ) : models.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No OpenRouter models registered yet.
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {models.map((model) => (
                <li
                  key={model.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {model.name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {model.ai_lab}
                      </span>
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {model.route}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeModel(model)}
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                    aria-label={`Remove ${model.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {modalOpen && (
        <dialog
          className={modalShell}
          open
          aria-labelledby="add-openrouter-model"
        >
          <div className="max-h-none w-full max-w-[460px]">
            <div className="ui-animate-modal-panel grid rounded-xl border border-border-subtle bg-surface">
              <div className={modalHeader}>
                <div>
                  <div className={eyebrowText}>OpenRouter</div>
                  <h2
                    id="add-openrouter-model"
                    className="mt-1 text-[1.0625rem] font-semibold tracking-[-0.02em]"
                  >
                    Add model
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className={modalCloseButton}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <form
                className="flex flex-col gap-3 px-[18px] pb-[18px] pt-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (lookup) void addModel();
                  else void lookUpRoute();
                }}
              >
                <label htmlFor="openrouter-route" className={labelClass}>
                  Model route
                </label>
                <input
                  id="openrouter-route"
                  ref={routeInputRef}
                  value={route}
                  onChange={(event) => {
                    setRoute(event.target.value);
                    setLookup(null);
                  }}
                  placeholder="lab/model"
                  autoComplete="off"
                  className={inputClass}
                />
                <p className={hintClass}>Paste a route from OpenRouter.</p>
                {lookup && (
                  <div className="rounded-lg border border-border-subtle bg-background p-3 text-sm">
                    <p className="font-medium text-foreground">
                      {lookup.name}
                      <span className="ml-2 text-muted-foreground">
                        {lookup.ai_lab}
                      </span>
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {lookup.route}
                    </p>
                    {!lookup.found && (
                      <p className="mt-2 text-xs text-amber-400">
                        OpenRouter could not confirm this route right now; the
                        name and lab were parsed from the route.
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => setModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adding || !route.trim()}
                    className={primaryButton}
                  >
                    {adding
                      ? "Working..."
                      : lookup
                        ? "Add to registry"
                        : "Look up model"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
