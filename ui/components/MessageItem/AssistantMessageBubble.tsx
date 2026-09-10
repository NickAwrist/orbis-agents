import {
  Check,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Gauge,
  Waypoints,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { WorkspaceFileAttachment } from "../../../src/attachments/types";
import { readApiError } from "../../lib/readApiError";
import { userScopedFetch } from "../../persist/userIdentity";
import { cx } from "../../styles";
import type { Message } from "../../types";
import { traceStepsForDisplay } from "../ExecutionTrace";
import {
  formatCost,
  formatTokensPerSecond,
  summarizeTraceMetrics,
} from "../ExecutionTrace/traceMetrics";
import { MarkdownMessage, extractComfyUIImageUrls } from "../MarkdownMessage";
import { msgIconBtn, msgIconSize, msgIconStroke } from "./messageItemStyles";

type Props = {
  message: Message;
  animateEntry: boolean;
  enterStyle: CSSProperties | undefined;
  copied: boolean;
  copyContent: () => void;
  onViewSteps?: () => void;
};

export function AssistantMessageBubble({
  message,
  animateEntry,
  enterStyle,
  copied,
  copyContent,
  onViewSteps,
}: Props) {
  const comfyImageUrls = extractComfyUIImageUrls(message.content);
  const outputFiles =
    message.attachments?.filter(
      (attachment): attachment is WorkspaceFileAttachment =>
        attachment.kind === "file",
    ) ?? [];
  const stats = summarizeTraceMetrics(message.steps);
  return (
    <div
      className={cx(
        "group/msg flex w-full min-w-0 flex-col",
        animateEntry && "ui-animate-slide-up",
      )}
      style={enterStyle}
    >
      <div
        className="flex w-full justify-start pt-4 max-[640px]:pt-3.5"
        aria-hidden
      >
        <div className="h-px w-9 max-[640px]:w-8 shrink-0 rounded-full bg-border-subtle/70" />
      </div>
      <div className="max-w-[min(100%,42rem)] min-w-0 pt-2">
        <div className="-mx-2 rounded-lg px-2">
          <MarkdownMessage className="text-foreground">
            {message.content}
          </MarkdownMessage>
          {outputFiles.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5">
              {outputFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => void openOutputFile(file)}
                  className="flex max-w-md items-center gap-2 rounded-lg border border-border-subtle bg-muted/40 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  <FileText
                    size={15}
                    className="shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  {file.workspaceKind === "local" ? (
                    <FolderOpen
                      size={14}
                      className="shrink-0 text-muted-foreground"
                    />
                  ) : (
                    <Download
                      size={14}
                      className="shrink-0 text-muted-foreground"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          className={cx(
            "mt-2 flex flex-wrap items-center gap-1",
            "message-actions opacity-0 transition-opacity duration-300 ease-out",
            "group-hover/msg:opacity-100 focus-within:opacity-100",
          )}
        >
          {stats &&
            (stats.tokensPerSecond !== undefined ||
              stats.inputTokens !== undefined ||
              stats.outputTokens !== undefined) && (
              <span
                className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-border-subtle bg-transparent px-1.5 text-[0.6875rem] font-medium text-muted-foreground"
                title={[
                  stats.tokensPerSecond !== undefined
                    ? `${formatTokensPerSecond(stats.tokensPerSecond)} tokens/sec`
                    : null,
                  stats.inputTokens !== undefined
                    ? `${stats.inputTokens} input tokens`
                    : null,
                  stats.outputTokens !== undefined
                    ? `${stats.outputTokens} output tokens`
                    : null,
                  stats.cost !== undefined
                    ? `${formatCost(stats.cost)} OpenRouter cost`
                    : null,
                  stats.calls === 1 ? "1 LLM call" : `${stats.calls} LLM calls`,
                ]
                  .filter(Boolean)
                  .join(" - ")}
                aria-label="Generation speed"
              >
                <Gauge size={msgIconSize} strokeWidth={msgIconStroke} />
                {stats.tokensPerSecond !== undefined
                  ? `${formatTokensPerSecond(stats.tokensPerSecond)} tok/s`
                  : `${stats.outputTokens ?? stats.inputTokens} tokens`}
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
          {comfyImageUrls.map((href, index) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={msgIconBtn}
              title="Open image"
              aria-label={
                comfyImageUrls.length > 1
                  ? `Open generated image ${index + 1} in new tab`
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

async function openOutputFile(file: WorkspaceFileAttachment): Promise<void> {
  if (file.workspaceKind === "local") {
    const route = file.temporary
      ? `/api/temporary-sessions/${encodeURIComponent(file.sessionId)}/reveal`
      : `/api/sessions/${encodeURIComponent(file.sessionId)}/workspace/reveal`;
    const response = await userScopedFetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: file.path }),
    });
    if (!response.ok) window.alert(await readApiError(response));
    return;
  }
  const route = file.temporary
    ? `/api/temporary-sessions/${encodeURIComponent(file.sessionId)}/file`
    : `/api/sessions/${encodeURIComponent(file.sessionId)}/workspace/file`;
  const response = await userScopedFetch(
    `${route}?path=${encodeURIComponent(file.path)}`,
  );
  if (!response.ok) {
    window.alert(await readApiError(response));
    return;
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}
