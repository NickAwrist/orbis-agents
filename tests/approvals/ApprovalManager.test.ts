import { describe, expect, test } from "bun:test";
import { ApprovalManager } from "../../src/approvals/ApprovalManager";

describe("approval manager", () => {
  test("resolves only for the matching owner and run", async () => {
    const manager = new ApprovalManager();
    let approvalId = "";
    const pending = manager.request({
      ownerUuid: "owner-a",
      requestId: "run-a",
      emit: (id) => {
        approvalId = id;
      },
    });
    expect(
      manager.resolve({
        ownerUuid: "owner-b",
        requestId: "run-a",
        approvalId,
        approved: true,
      }),
    ).toBeFalse();
    expect(
      manager.resolve({
        ownerUuid: "owner-a",
        requestId: "run-a",
        approvalId,
        approved: true,
      }),
    ).toBeTrue();
    expect(await pending).toBeTrue();
  });

  test("denies on abort and timeout", async () => {
    const manager = new ApprovalManager();
    const controller = new AbortController();
    const aborted = manager.request({
      ownerUuid: "owner-a",
      requestId: "run-a",
      signal: controller.signal,
      emit: () => {},
    });
    controller.abort();
    expect(await aborted).toBeFalse();

    expect(
      await manager.request({
        ownerUuid: "owner-a",
        requestId: "run-b",
        timeoutMs: 1,
        emit: () => {},
      }),
    ).toBeFalse();
  });
});
