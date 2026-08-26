import { ArrowUp, ImagePlus, Square, Upload, X } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { cx, iconButton, primaryButton } from "../styles";
import type { MessageStep } from "../types";

export function RunInputDock({
  input,
  setInput,
  onSendMessage,
  onStopGeneration,
  runPending,
  streamingStep,
  streamingSteps,
  modelSendReady,
  pendingImages,
  imageError,
  addPendingImages,
  removePendingImage,
  supportsImageInput,
  canAttachImages,
  attachImageDisabledReason,
  attachmentsSendReady,
  onFooterHeightChange,
}: {
  input: string;
  setInput: (v: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  onStopGeneration: () => void;
  runPending: boolean;
  streamingStep: MessageStep | null;
  streamingSteps: MessageStep[];
  modelSendReady: boolean;
  pendingImages: Array<{ id: string; file: File; previewUrl: string }>;
  imageError: string | null;
  addPendingImages: (files: File[]) => void;
  removePendingImage: (id: string) => void;
  supportsImageInput: boolean;
  canAttachImages: boolean;
  attachImageDisabledReason?: string;
  attachmentsSendReady: boolean;
  onFooterHeightChange: (heightPx: number) => void;
}) {
  const footerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const isBusy =
    runPending || streamingStep !== null || streamingSteps.length > 0;
  const canSend = modelSendReady && attachmentsSendReady && !isBusy;

  const syncInputHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const maxPx = window.innerHeight * 0.3;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
  }, []);

  useLayoutEffect(() => {
    syncInputHeight();
  }, [input, syncInputHeight]);

  useLayoutEffect(() => {
    const onResize = () => syncInputHeight();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncInputHeight]);

  useLayoutEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      if (h > 0) onFooterHeightChange(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onFooterHeightChange]);

  return (
    <div
      ref={footerRef}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center border-t border-border-subtle/60 bg-background/[0.16] px-5 pb-4 pt-3 shadow-[0_-1px_0_0_rgba(255,255,255,0.03)] backdrop-blur-xl backdrop-saturate-125 max-[640px]:px-3.5 max-[640px]:pb-3.5 max-[640px]:pt-2.5"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSendMessage(e);
        }}
        onDragEnter={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          dragDepthRef.current += 1;
          setIsFileDragActive(true);
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect =
            canAttachImages && !isBusy ? "copy" : "none";
        }}
        onDragLeave={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setIsFileDragActive(false);
        }}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer.files);
          dragDepthRef.current = 0;
          setIsFileDragActive(false);
          if (files.length === 0) return;
          e.preventDefault();
          addPendingImages(files);
        }}
        className={cx(
          "pointer-events-auto relative flex w-full max-w-3xl flex-col gap-1 rounded-xl border bg-surface px-[10px] py-[6px] transition-[border-color,background-color,box-shadow] duration-150 ease-out focus-within:border-border focus-within:shadow-[0_0_0_1px_var(--color-accent-ring)]",
          isFileDragActive
            ? "border-accent/60 bg-accent-soft-strong shadow-[0_0_0_3px_var(--color-accent-ring)]"
            : "border-border-subtle",
        )}
      >
        <div
          aria-hidden={!isFileDragActive}
          className={cx(
            "pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] border border-dashed border-accent/60 bg-surface/95 text-accent backdrop-blur-sm transition-[opacity,transform,visibility] duration-150 ease-out",
            isFileDragActive
              ? "visible scale-100 opacity-100"
              : "invisible scale-[0.985] opacity-0",
          )}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Upload size={17} strokeWidth={2} />
            <span>Drop to attach</span>
          </div>
        </div>
        {pendingImages.length > 0 && (
          <div className="flex max-w-full gap-2 overflow-x-auto px-1 pt-1">
            {pendingImages.map((image) => (
              <div
                key={image.id}
                className="group/image relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-muted"
              >
                <img
                  src={image.previewUrl}
                  alt={image.file.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePendingImage(image.id)}
                  disabled={isBusy}
                  className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur hover:bg-background disabled:opacity-50"
                  aria-label={`Remove ${image.file.name}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {imageError && (
          <p className="px-1 pt-1 text-xs text-red-300" role="alert">
            {imageError}
          </p>
        )}
        <div className="flex w-full items-end gap-1">
          {supportsImageInput && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(e) => {
                  addPendingImages(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy || !canAttachImages}
                className={cx(
                  iconButton,
                  "mb-0.5 size-9 shrink-0 border-transparent p-0",
                )}
                title={attachImageDisabledReason ?? "Add images"}
                aria-label={attachImageDisabledReason ?? "Add images"}
              >
                <ImagePlus size={17} />
              </button>
            </>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.length > 0) {
                e.preventDefault();
                addPendingImages(files);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSendMessage(e);
              }
            }}
            disabled={isBusy}
            placeholder="Send a message..."
            className="min-h-10 max-h-[30vh] w-full flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2.5 text-[0.9375rem] leading-[1.5] text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            rows={1}
          />
          {isBusy ? (
            <button
              type="button"
              onClick={onStopGeneration}
              className={cx(
                iconButton,
                "mb-0.5 size-9 shrink-0 p-0 hover:border-red-500/20 hover:bg-red-500/[0.06] hover:text-red-300",
              )}
              aria-label="Stop generation"
            >
              <Square size={12} strokeWidth={2.25} className="shrink-0" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || !canSend}
              className={cx(
                primaryButton,
                "mb-0.5 size-9 shrink-0 justify-center rounded-lg p-0",
              )}
              aria-label="Send message"
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
