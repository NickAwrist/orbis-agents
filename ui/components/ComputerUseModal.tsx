import { Monitor, ShieldCheck, X } from "lucide-react";
import {
  modalCloseButton,
  modalHeader,
  modalShell,
  modalSurface,
} from "../styles";

export function ComputerUseModal({ onClose }: { onClose: () => void }) {
  return (
    <dialog open className={modalShell} aria-label="Computer use controls">
      <div className={`${modalSurface} w-full max-w-md`}>
        <div className={modalHeader}>
          <div>
            <h2 className="text-sm font-semibold">Computer use</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Off for this chat
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={modalCloseButton}
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <Monitor
              className="mt-0.5 shrink-0 text-muted-foreground"
              size={18}
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                No computer adapter is configured
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                This installation cannot control browser or desktop apps yet.
                Computer tools remain unavailable to the model.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-muted/35 p-3">
            <ShieldCheck
              className="mt-0.5 shrink-0 text-muted-foreground"
              size={17}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Directory access and computer control are separate permissions.
              Working in a local folder does not grant control of any app.
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
