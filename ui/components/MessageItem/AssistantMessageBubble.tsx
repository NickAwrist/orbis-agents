import { Check, Copy, Download, Gauge, Waypoints } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { cx } from "../../styles";
import type { Message } from "../../types";
import { traceStepsForDisplay } from "../ExecutionTrace";
import {
  formatCost,
  formatTokensPerSecond,
  summarizeTraceMetrics,
} from "../ExecutionTrace/traceMetrics";
import { FloatingOptionsMenu } from "../FloatingOptionsMenu";
import { MarkdownMessage, extractComfyUIImageUrls } from "../MarkdownMessage";
import { msgIconBtn, msgIconSize, msgIconStroke } from "./messageItemStyles";

const LONG_PRESS_MS = 520;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;
const messageActionMenuItem =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[0.8125rem] text-foreground transition-[color,background-color,transform] duration-150 ease-out hover:bg-muted active:scale-[0.99] active:bg-muted/80";

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
  const stats = summarizeTraceMetrics(message.steps);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressOpenedRef = useRef(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<DOMRect | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
    setIsLongPressing(false);
  };

  const openActionMenu = (element: HTMLElement) => {
    setActionMenuAnchor(element.getBoundingClientRect());
  };

  const closeActionMenu = () => {
    longPressOpenedRef.current = false;
    setActionMenuAnchor(null);
  };

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
        <div
          className={cx(
            "-mx-2 rounded-lg px-2 transition-colors duration-150",
            isLongPressing && "bg-muted/40",
          )}
          onPointerDown={(event) => {
            if (event.pointerType !== "touch" && event.pointerType !== "pen") {
              return;
            }
            const target = event.currentTarget;
            longPressOpenedRef.current = false;
            clearLongPressTimer();
            setIsLongPressing(true);
            longPressStartRef.current = {
              x: event.clientX,
              y: event.clientY,
            };
            longPressTimerRef.current = window.setTimeout(() => {
              longPressOpenedRef.current = true;
              openActionMenu(target);
              clearLongPressTimer();
            }, LONG_PRESS_MS);
          }}
          onPointerMove={(event) => {
            const start = longPressStartRef.current;
            if (!start) return;
            const moved =
              Math.abs(event.clientX - start.x) >
                LONG_PRESS_MOVE_TOLERANCE_PX ||
              Math.abs(event.clientY - start.y) > LONG_PRESS_MOVE_TOLERANCE_PX;
            if (moved) clearLongPressTimer();
          }}
          onPointerUp={clearLongPressTimer}
          onPointerCancel={clearLongPressTimer}
          onPointerLeave={clearLongPressTimer}
          onContextMenu={(event) => {
            const pointerType =
              "pointerType" in event.nativeEvent
                ? event.nativeEvent.pointerType
                : undefined;
            if (pointerType === "mouse") return;
            event.preventDefault();
            clearLongPressTimer();
            longPressOpenedRef.current = true;
            openActionMenu(event.currentTarget);
          }}
          onClickCapture={(event) => {
            if (!longPressOpenedRef.current) return;
            event.preventDefault();
            event.stopPropagation();
            longPressOpenedRef.current = false;
          }}
        >
          <MarkdownMessage className="text-foreground">
            {message.content}
          </MarkdownMessage>
        </div>

        <div
          className={cx(
            "mt-2 flex flex-wrap items-center gap-1",
            "opacity-0 transition-opacity duration-300 ease-out",
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

      {actionMenuAnchor && (
        <FloatingOptionsMenu
          anchorRect={actionMenuAnchor}
          minWidth={160}
          onClose={closeActionMenu}
        >
          <button
            type="button"
            onClick={() => {
              closeActionMenu();
              void copyContent();
            }}
            className={messageActionMenuItem}
            role="menuitem"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
          {onViewSteps && (
            <button
              type="button"
              onClick={() => {
                closeActionMenu();
                onViewSteps();
              }}
              className={messageActionMenuItem}
              role="menuitem"
            >
              <Waypoints size={14} />
              View trace
            </button>
          )}
        </FloatingOptionsMenu>
      )}
    </div>
  );
}
