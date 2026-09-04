import crypto from "node:crypto";

export type ApprovalRequest = {
  kind: "computer_app" | "high_impact";
  title: string;
  target: string;
  action: string;
};

type PendingApproval = {
  ownerUuid: string;
  requestId: string;
  resolve: (approved: boolean) => void;
  timeout: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abort?: () => void;
};

const APPROVAL_TIMEOUT_MS = 2 * 60 * 1000;

export class ApprovalManager {
  private readonly pending = new Map<string, PendingApproval>();

  request(options: {
    ownerUuid: string;
    requestId: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    emit: (approvalId: string) => void;
  }): Promise<boolean> {
    const approvalId = crypto.randomUUID();
    return new Promise((resolve) => {
      const finish = (approved: boolean) => {
        const pending = this.pending.get(approvalId);
        if (!pending) return;
        this.pending.delete(approvalId);
        clearTimeout(pending.timeout);
        if (pending.abort && pending.signal) {
          pending.signal.removeEventListener("abort", pending.abort);
        }
        resolve(approved);
      };
      const pending: PendingApproval = {
        ownerUuid: options.ownerUuid,
        requestId: options.requestId,
        resolve: finish,
        timeout: setTimeout(
          () => finish(false),
          options.timeoutMs ?? APPROVAL_TIMEOUT_MS,
        ),
        signal: options.signal,
      };
      pending.abort = () => finish(false);
      this.pending.set(approvalId, pending);
      if (options.signal?.aborted) {
        finish(false);
        return;
      }
      options.signal?.addEventListener("abort", pending.abort, { once: true });
      options.emit(approvalId);
    });
  }

  resolve(options: {
    ownerUuid: string;
    requestId: string;
    approvalId: string;
    approved: boolean;
  }): boolean {
    const pending = this.pending.get(options.approvalId);
    if (
      !pending ||
      pending.ownerUuid !== options.ownerUuid ||
      pending.requestId !== options.requestId
    ) {
      return false;
    }
    pending.resolve(options.approved);
    return true;
  }

  denyRequest(ownerUuid: string, requestId: string): void {
    for (const pending of this.pending.values()) {
      if (pending.ownerUuid === ownerUuid && pending.requestId === requestId) {
        pending.resolve(false);
      }
    }
  }
}

export const approvalManager = new ApprovalManager();
