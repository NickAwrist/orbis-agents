import { Bot } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { useStickToBottom } from "use-stick-to-bottom";
import { traceStepsForDisplay } from "../ExecutionTrace";
import { MarkdownMessage } from "../MarkdownMessage";
import { MessageItem } from "../MessageItem";
import { StreamingStatusRow } from "./StreamingStatusRow";
import type { RunAreaProps } from "./types";

export function RunArea({
  messages,
  streamingSteps,
  streamingStep,
  streamingContent,
  runPending,
  footerInset,
  onViewSteps,
  editingUserIndex,
  onStartEditUser,
  onCancelEditUser,
  onRequestEditConfirm,
  onRequestRetryConfirm,
}: RunAreaProps) {
  const { scrollRef, contentRef, scrollToBottom, isAtBottom } =
    useStickToBottom({
      initial: "instant",
    });
  const isBusy =
    runPending || streamingStep !== null || streamingSteps.length > 0;
  const hasRenderedHistoryRef = useRef(false);
  const animateMessageEntries = hasRenderedHistoryRef.current;

  useLayoutEffect(() => {
    if (messages.length === 0 || hasRenderedHistoryRef.current) return;
    const scrollElement = scrollRef.current;
    if (scrollElement) scrollElement.scrollTop = scrollElement.scrollHeight;
    hasRenderedHistoryRef.current = true;
  }, [messages.length, scrollRef]);

  useLayoutEffect(() => {
    if (isAtBottom) {
      void scrollToBottom({
        animation: "instant",
        preserveScrollPosition: true,
      });
    }
  }, [footerInset, isAtBottom, scrollToBottom]);

  return (
    <div className="relative h-full min-h-0 flex-1 overflow-x-hidden">
      <div
        ref={scrollRef}
        className="absolute inset-0 z-0 overflow-x-hidden overflow-y-auto px-5 pt-[calc(3.5rem+1.25rem)] max-[640px]:px-3.5 max-[640px]:pt-[calc(52px+1rem)]"
        style={{ paddingBottom: footerInset + 12 }}
      >
        <div
          ref={contentRef}
          className="mx-auto flex min-h-min w-full max-w-3xl flex-col"
        >
          {messages.length === 0 && (
            <div className="flex items-center gap-2 bg-transparent py-8 text-[0.875rem] text-muted-foreground">
              <Bot size={14} />
              <p>Start the session with a message below.</p>
            </div>
          )}

          {messages.map((message, index) => (
            <MessageItem
              key={`${message.role}:${message.content.slice(0, 80)}:${message.steps?.length ?? 0}`}
              messageIndex={index}
              message={message}
              animateEntry={animateMessageEntries}
              animDelayMs={Math.min(index, 10) * 32}
              onViewSteps={
                message.steps && traceStepsForDisplay(message.steps).length > 0
                  ? () => onViewSteps(message.steps!)
                  : undefined
              }
              isBusy={isBusy}
              editingUserIndex={editingUserIndex}
              onStartEditUser={onStartEditUser}
              onCancelEditUser={onCancelEditUser}
              onRequestEditConfirm={onRequestEditConfirm}
              onRequestRetryConfirm={onRequestRetryConfirm}
            />
          ))}

          {(streamingStep || streamingSteps.length > 0) && (
            <StreamingStatusRow
              streamingStep={streamingStep}
              streamingSteps={streamingSteps}
              streamingContent={streamingContent}
              onViewSteps={onViewSteps}
            />
          )}

          {streamingContent && (
            <div className="ui-animate-slide-up flex w-full min-w-0 flex-col">
              <div className="max-w-[min(100%,42rem)] min-w-0 pt-4 max-[640px]:pt-3.5">
                <MarkdownMessage className="text-foreground">
                  {streamingContent}
                </MarkdownMessage>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
