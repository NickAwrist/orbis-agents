import { ShieldAlert, X } from "lucide-react";
import {
  modalCloseButton,
  modalHeader,
  modalShell,
  modalSurface,
  primaryButton,
  secondaryButton,
} from "../styles";
import type { PendingApproval } from "../types";

export function ApprovalModal({
  approval,
  onResolve,
}: {
  approval: PendingApproval;
  onResolve: (approved: boolean) => void | Promise<void>;
}) {
  return (
    <dialog open className={modalShell} aria-label="Approval required">
      <div className={`${modalSurface} w-full max-w-md`}>
        <div className={modalHeader}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={17} className="text-amber-400" />
            <h2 className="text-sm font-semibold">{approval.title}</h2>
          </div>
          <button
            type="button"
            onClick={() => void onResolve(false)}
            className={modalCloseButton}
            aria-label="Deny"
          >
            <X size={17} />
          </button>
        </div>
        <div className="p-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Target</dt>
            <dd className="break-all text-foreground">{approval.target}</dd>
            <dt className="text-muted-foreground">Action</dt>
            <dd className="text-foreground">{approval.action}</dd>
          </dl>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className={secondaryButton}
              onClick={() => void onResolve(false)}
            >
              Deny
            </button>
            <button
              type="button"
              className={primaryButton}
              onClick={() => void onResolve(true)}
            >
              Allow once
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
