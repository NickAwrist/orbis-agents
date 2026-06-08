import { X } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  eyebrowText,
  modalCloseButton,
  modalHeader,
  modalShell,
  primaryButton,
  secondaryButton,
} from "../styles";

export function RenameSessionModal({
  initialTitle,
  onSave,
  onClose,
}: {
  initialTitle: string;
  onSave: (title: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape") onClose();
  };

  return (
    <dialog
      className={modalShell}
      aria-labelledby="rename-session-title"
      open
      onClick={handleDialogClick}
      onKeyDown={handleDialogKeyDown}
    >
      <div className="max-h-none w-full max-w-[400px]">
        <div className="ui-animate-modal-panel grid rounded-xl border border-border-subtle bg-surface">
          <div className={modalHeader}>
            <div>
              <div className={eyebrowText}>Run</div>
              <h2
                id="rename-session-title"
                className="mt-1 text-[1.0625rem] font-semibold tracking-[-0.02em]"
              >
                Rename
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={modalCloseButton}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <form
            className="flex flex-col gap-2 px-[18px] pb-[18px] pt-0"
            onSubmit={(e) => {
              e.preventDefault();
              onSave(value.trim());
            }}
          >
            <label
              className="text-[0.8125rem] font-medium text-muted-foreground"
              htmlFor="rename-session-input"
            >
              Display name
            </label>
            <input
              id="rename-session-input"
              ref={inputRef}
              className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2.5 text-[0.9375rem] text-foreground outline-none focus:border-accent focus:shadow-[0_0_0_1px_var(--color-accent-ring)]"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Uses last user message if empty"
              autoComplete="off"
            />
            <p className="m-0 text-[0.75rem] leading-[1.45] text-muted-foreground">
              Leave empty to show the latest user message as the title.
            </p>
            <div className="mt-[14px] flex justify-end gap-2">
              <button
                type="button"
                className={secondaryButton}
                onClick={onClose}
              >
                Cancel
              </button>
              <button type="submit" className={primaryButton}>
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  );
}
