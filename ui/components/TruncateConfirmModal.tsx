import { X } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useId } from "react";
import {
  cx,
  eyebrowText,
  modalCloseButton,
  modalHeader,
  modalShell,
  primaryButton,
  secondaryButton,
} from "../styles";

export function TruncateConfirmModal({
  title,
  description,
  confirmLabel = "Continue",
  busyConfirmLabel = "Please wait...",
  onConfirm,
  onClose,
  busy = false,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  busyConfirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  busy?: boolean;
}) {
  const titleId = useId();

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) handleClose();
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape") handleClose();
  };

  return (
    <dialog
      className={modalShell}
      aria-labelledby={titleId}
      open
      onClick={handleDialogClick}
      onKeyDown={handleDialogKeyDown}
    >
      <div className="max-h-none w-full max-w-[400px]">
        <div className="ui-animate-modal-panel grid rounded-xl border border-border-subtle bg-surface">
          <div className={modalHeader}>
            <div>
              <div className={eyebrowText}>Warning</div>
              <h2
                id={titleId}
                className="mt-1 text-[1.0625rem] font-semibold tracking-[-0.02em]"
              >
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={busy}
              className={cx(
                modalCloseButton,
                busy && "pointer-events-none opacity-40",
              )}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="px-[18px] py-4 sm:px-3.5">
            <p className="m-0 text-[0.875rem] leading-[1.6] text-muted-foreground">
              {description}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={busy}
                className={secondaryButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void Promise.resolve(onConfirm())}
                disabled={busy}
                className={cx(
                  primaryButton,
                  "!bg-[#991b1b] hover:!bg-[#b91c1c] !text-white",
                  busy && "opacity-80",
                )}
              >
                {busy ? busyConfirmLabel : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
