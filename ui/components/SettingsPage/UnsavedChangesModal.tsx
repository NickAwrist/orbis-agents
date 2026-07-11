import { X } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useEffect, useId, useRef } from "react";
import {
  cx,
  eyebrowText,
  modalCloseButton,
  modalHeader,
  modalShell,
  primaryButton,
  secondaryButton,
} from "../../styles";

export function UnsavedChangesModal({
  saving,
  onStay,
  onDiscard,
  onSaveAndLeave,
}: {
  saving: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSaveAndLeave: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const handleDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget && !saving) onStay();
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape" && !saving) onStay();
    if (event.key === "Enter" && !saving) {
      event.preventDefault();
      onSaveAndLeave();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={modalShell}
      aria-labelledby={titleId}
      open
      tabIndex={-1}
      onClick={handleDialogClick}
      onKeyDown={handleDialogKeyDown}
    >
      <div className="max-h-none w-full max-w-[440px]">
        <div className="ui-animate-modal-panel grid rounded-xl border border-border-subtle bg-surface">
          <div className={modalHeader}>
            <div>
              <div className={eyebrowText}>Unsaved changes</div>
              <h2
                id={titleId}
                className="mt-1 text-[1.0625rem] font-semibold tracking-[-0.02em]"
              >
                Leave settings?
              </h2>
            </div>
            <button
              type="button"
              onClick={onStay}
              disabled={saving}
              className={cx(
                modalCloseButton,
                saving && "pointer-events-none opacity-40",
              )}
              aria-label="Keep editing"
            >
              <X size={18} />
            </button>
          </div>
          <div className="px-[18px] py-4 sm:px-3.5">
            <p className="m-0 text-[0.875rem] leading-[1.6] text-muted-foreground">
              You have changes that have not been saved yet.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onStay}
                disabled={saving}
                className={secondaryButton}
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={onDiscard}
                disabled={saving}
                className={secondaryButton}
              >
                Discard changes
              </button>
              <button
                type="button"
                onClick={onSaveAndLeave}
                disabled={saving}
                aria-busy={saving}
                className={cx(primaryButton, saving && "opacity-80")}
              >
                {saving ? "Saving..." : "Save & leave"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
