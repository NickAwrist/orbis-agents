import type { UserSettings } from "../../persist/userSettings";
import { cx, eyebrowText } from "../../styles";
import type { ModelOption } from "../../types";
import { hintClass, inputClass, labelClass, selectClass } from "./constants";

type Props = {
  settings: UserSettings;
  onFieldChange: (field: keyof UserSettings, value: string) => void;
  availableModels: ModelOption[];
};

export function GeneralSettingsTab({
  settings,
  onFieldChange,
  availableModels,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className={cx(eyebrowText, "mb-4")}>Personal Information</h2>
        <div className="space-y-2">
          <label htmlFor="name" className={labelClass}>
            Name <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            type="text"
            id="name"
            value={settings.name}
            onChange={(e) => onFieldChange("name", e.target.value)}
            placeholder="Enter your name"
            className={inputClass}
          />
          <p className={hintClass}>
            Your name will be used in conversations and messages.
          </p>
        </div>
        <div className="mt-4 space-y-2">
          <label htmlFor="location" className={labelClass}>
            Location <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            type="text"
            id="location"
            value={settings.location}
            onChange={(e) => onFieldChange("location", e.target.value)}
            placeholder="e.g., New York, USA"
            className={inputClass}
          />
          <p className={hintClass}>
            Your location can help provide more relevant responses.
          </p>
        </div>
      </div>

      <hr className="border-border-subtle" />

      <div className="space-y-4">
        <h2 className={cx(eyebrowText, "mb-4")}>Preferences</h2>
        <div className="space-y-2">
          <label htmlFor="preferredFormats" className={labelClass}>
            Preferred Response Formats{" "}
            <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="preferredFormats"
            value={settings.preferredFormats}
            onChange={(e) => onFieldChange("preferredFormats", e.target.value)}
            placeholder="e.g., JSON, Markdown tables, bullet points, code snippets"
            rows={3}
            className="min-h-[100px] w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-[0.875rem] text-foreground placeholder:text-muted-foreground transition-colors focus:border-border focus:outline-none"
          />
          <p className={hintClass}>
            Specify how you prefer responses to be formatted.
          </p>
        </div>
      </div>

      <hr className="border-border-subtle" />

      <div className="space-y-2">
        <h2 className={cx(eyebrowText, "mb-2")}>Chat Defaults</h2>
        <p className={hintClass}>
          Choose the model used when you start a new conversation.
        </p>
        <div className="space-y-2">
          <label htmlFor="defaultModel" className={labelClass}>
            Default Model
          </label>
          <select
            id="defaultModel"
            value={settings.defaultModel}
            onChange={(e) => onFieldChange("defaultModel", e.target.value)}
            className={selectClass}
          >
            <option value="">Select a default model</option>
            {(["ollama", "openrouter"] as const).map((provider) => {
              const models = availableModels.filter(
                (model) => model.provider === provider,
              );
              if (models.length === 0) return null;
              return (
                <optgroup
                  key={provider}
                  label={
                    provider === "ollama" ? "Ollama (local)" : "OpenRouter"
                  }
                >
                  {models.map((model) => (
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
          </select>
          <p className={hintClass}>
            This model will be used for new conversations.
          </p>
        </div>
      </div>
    </div>
  );
}
