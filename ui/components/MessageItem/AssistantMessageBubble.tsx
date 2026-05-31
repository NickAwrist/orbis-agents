import { Check, Copy, Download, Gauge, Waypoints } from "lucide-react";
import type { CSSProperties } from "react";
import { cx } from "../../styles";
import type { Message } from "../../types";
import { traceStepsForDisplay } from "../ExecutionTrace";
import { MarkdownMessage, extractComfyUIImageUrls } from "../MarkdownMessage";
import { msgIconBtn, msgIconSize, msgIconStroke } from "./messageItemStyles";

type AssistantGenerationStats = {
  calls: number;
  outputTokens?: number;
  tokensPerSecond?: number;
};

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function collectLlmMetrics(
  steps: Message["steps"] | undefined,
  out: NonNullable<Message["steps"]>[number]["metrics"][] = [],
) {
  for (const step of steps ?? []) {
    if (step.kind === "llm_call" && step.metrics) out.push(step.metrics);
    if (step.childRun?.steps?.length)
      collectLlmMetrics(step.childRun.steps, out);
  }
  return out;
}

function generationStats(message: Message): AssistantGenerationStats | null {
  const metrics = collectLlmMetrics(message.steps);
  if (metrics.length === 0) return null;

  let outputTokens = 0;
  let outputDurationMs = 0;
  let lastTokensPerSecond: number | undefined;
  for (const m of metrics) {
    outputTokens += finiteNumber(m?.outputTokens) ?? 0;
    outputDurationMs += finiteNumber(m?.outputDurationMs) ?? 0;
    lastTokensPerSecond =
      finiteNumber(m?.tokensPerSecond) ?? lastTokensPerSecond;
  }

  const tokensPerSecond =
    outputTokens > 0 && outputDurationMs > 0
      ? outputTokens / (outputDurationMs / 1000)
      : lastTokensPerSecond;

  return {
    calls: metrics.length,
    outputTokens: outputTokens > 0 ? outputTokens : undefined,
    tokensPerSecond,
  };
}

function formatTokensPerSecond(value: number): string {
  if (value >= 100) return Math.round(value).toString();
  return value.toFixed(1);
}

type Props = {
  message: Message;
  enterStyle: CSSProperties | undefined;
  copied: boolean;
  copyContent: () => void;
  onViewSteps?: () => void;
};

export function AssistantMessageBubble({
  message,
  enterStyle,
  copied,
  copyContent,
  onViewSteps,
}: Props) {
  const comfyImageUrls = extractComfyUIImageUrls(message.content);
  const stats = generationStats(message);

  return (
    <div
      className="group/msg ui-animate-slide-up flex w-full min-w-0 flex-col"
      style={enterStyle}
    >
      <div
        className="flex w-full justify-start pt-4 max-[640px]:pt-3.5"
        aria-hidden
      >
        <div className="h-px w-9 max-[640px]:w-8 shrink-0 rounded-full bg-border-subtle/70" />
      </div>
      <div className="max-w-[min(100%,42rem)] min-w-0 pt-2">
        <MarkdownMessage className="text-foreground">
          {message.content}
        </MarkdownMessage>

        <div
          className={cx(
            "mt-2 flex flex-wrap items-center gap-1",
            "opacity-0 transition-opacity duration-300 ease-out",
            "group-hover/msg:opacity-100 focus-within:opacity-100",
          )}
        >
          {stats?.tokensPerSecond !== undefined && (
            <span
              className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-border-subtle bg-transparent px-1.5 text-[0.6875rem] font-medium text-muted-foreground"
              title={[
                `${formatTokensPerSecond(stats.tokensPerSecond)} tokens/sec`,
                stats.outputTokens !== undefined
                  ? `${stats.outputTokens} output tokens`
                  : null,
                stats.calls === 1 ? "1 LLM call" : `${stats.calls} LLM calls`,
              ]
                .filter(Boolean)
                .join(" · ")}
              aria-label="Generation speed"
            >
              <Gauge size={msgIconSize} strokeWidth={msgIconStroke} />
              {formatTokensPerSecond(stats.tokensPerSecond)} tok/s
            </span>
          )}
          <button
            type="button"
            onClick={() => void copyContent()}
            className={msgIconBtn}
            title={copied ? "Copied" : "Copy"}
            aria-label={copied ? "Copied" : "Copy message"}
          >
            {copied ? (
              <Check size={msgIconSize} strokeWidth={msgIconStroke} />
            ) : (
              <Copy size={msgIconSize} strokeWidth={msgIconStroke} />
            )}
          </button>
          {comfyImageUrls.map((href, i) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={msgIconBtn}
              title="Open image"
              aria-label={
                comfyImageUrls.length > 1
                  ? `Open generated image ${i + 1} in new tab`
                  : "Open generated image in new tab"
              }
            >
              <Download size={msgIconSize} strokeWidth={msgIconStroke} />
            </a>
          ))}
          {message.steps &&
            traceStepsForDisplay(message.steps).length > 0 &&
            onViewSteps && (
              <button
                type="button"
                onClick={onViewSteps}
                className={msgIconBtn}
                title="View trace"
                aria-label="View trace"
              >
                <Waypoints size={msgIconSize} strokeWidth={msgIconStroke} />
              </button>
            )}
        </div>
      </div>
    </div>
  );
}
