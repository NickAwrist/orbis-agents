import { cx, eyebrowText } from "../../styles";
import {
  ConnectionTestFeedback,
  ollamaConnectionFeedback,
} from "./ConnectionTestFeedback";
import { hintClass, inputClass, labelClass } from "./constants";
import type { OllamaTestState } from "./types";

export function OllamaSettingsTab({
  ollamaUri,
  onOllamaUriInput,
  ollamaConnected,
  testState,
  onTestOllama,
}: {
  ollamaUri: string;
  onOllamaUriInput: (value: string) => void;
  ollamaConnected: boolean | null;
  testState: OllamaTestState;
  onTestOllama: () => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className={cx(eyebrowText, "mb-2")}>Connection</h2>
        <p className={hintClass}>
          Use a local Ollama server for private, on-device models.
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="ollamaUri" className={labelClass}>
          Server URL
        </label>
        <div className="flex flex-wrap items-stretch gap-2 sm:flex-nowrap">
          <input
            type="text"
            id="ollamaUri"
            name="ollamaUri"
            value={ollamaUri}
            onChange={(event) => onOllamaUriInput(event.target.value)}
            placeholder="http://127.0.0.1:11434"
            autoComplete="off"
            className={cx(inputClass, "min-w-0 flex-1")}
          />
          <button
            type="button"
            onClick={() => void onTestOllama()}
            disabled={testState.status === "loading"}
            className="shrink-0 rounded-lg border border-border-subtle bg-muted/40 px-3 py-2 text-[0.875rem] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            {testState.status === "loading" ? "Testing..." : "Test connection"}
          </button>
        </div>
        <p className={hintClass}>
          Leave empty to use the default local Ollama address
          (http://127.0.0.1:11434).
        </p>
        <ConnectionTestFeedback
          {...ollamaConnectionFeedback(testState, ollamaConnected)}
        />
      </div>
    </section>
  );
}
