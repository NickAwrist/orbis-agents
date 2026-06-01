import { cx, eyebrowText } from "../../styles";
import {
  ConnectionTestFeedback,
  searxngConnectionFeedback,
} from "./ConnectionTestFeedback";
import { hintClass, inputClass, labelClass } from "./constants";
import type { SearXNGTestState } from "./types";

type Props = {
  searxngConnected: boolean | null;
  searxngUri: string;
  onSearxngUriInput: (v: string) => void;
  searxngTestState: SearXNGTestState;
  onTestSearXNG: () => void;
};

export function WebSearchTab({
  searxngConnected,
  searxngUri,
  onSearxngUriInput,
  searxngTestState,
  onTestSearXNG,
}: Props) {
  return (
    <div className="space-y-4">
      <h2 className={cx(eyebrowText, "mb-4")}>SearXNG</h2>

      <div className="space-y-2">
        <label htmlFor="searxngUri" className={labelClass}>
          Server URL
        </label>
        <div className="flex flex-wrap items-stretch gap-2 sm:flex-nowrap">
          <input
            type="text"
            id="searxngUri"
            value={searxngUri}
            onChange={(e) => onSearxngUriInput(e.target.value)}
            placeholder="http://127.0.0.1:8080"
            autoComplete="off"
            className={cx(inputClass, "min-w-0 flex-1")}
          />
          <button
            type="button"
            onClick={() => void onTestSearXNG()}
            disabled={searxngTestState.status === "loading"}
            className="shrink-0 rounded-lg border border-border-subtle bg-muted/40 px-3 py-2 text-[0.875rem] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            {searxngTestState.status === "loading"
              ? "Testing..."
              : "Test connection"}
          </button>
        </div>
        <p className={hintClass}>
          Leave empty to use the default local SearXNG address
          (http://127.0.0.1:8080).
        </p>
        <ConnectionTestFeedback
          {...searxngConnectionFeedback(searxngTestState, searxngConnected)}
        />
      </div>
    </div>
  );
}
