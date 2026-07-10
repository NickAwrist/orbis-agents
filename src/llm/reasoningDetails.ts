type ReasoningDetail = Record<string, unknown>;

function isRecord(value: unknown): value is ReasoningDetail {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compatibleIdentity(
  left: ReasoningDetail,
  right: ReasoningDetail,
): boolean {
  if (left.type !== right.type || left.index !== right.index) return false;
  for (const field of ["id", "format"] as const) {
    if (
      left[field] !== undefined &&
      right[field] !== undefined &&
      left[field] !== right[field]
    ) {
      return false;
    }
  }
  return true;
}

function contentField(
  detail: ReasoningDetail,
): "summary" | "text" | "data" | null {
  if (detail.type === "reasoning.summary") return "summary";
  if (detail.type === "reasoning.text") return "text";
  if (detail.type === "reasoning.encrypted") return "data";
  return null;
}

/** Reconstructs complete reasoning blocks from word-sized streaming deltas. */
export function compactReasoningDetails(details: unknown[]): unknown[] {
  const compacted: unknown[] = [];

  for (const detail of details) {
    if (!isRecord(detail)) {
      compacted.push(detail);
      continue;
    }

    const previous = compacted.at(-1);
    if (!isRecord(previous) || !compatibleIdentity(previous, detail)) {
      compacted.push({ ...detail });
      continue;
    }

    const field = contentField(detail);
    const previousContent = field ? previous[field] : undefined;
    const nextContent = field ? detail[field] : undefined;
    const merged = { ...previous, ...detail };
    if (
      field &&
      typeof previousContent === "string" &&
      typeof nextContent === "string"
    ) {
      merged[field] = previousContent + nextContent;
    }
    compacted[compacted.length - 1] = merged;
  }

  return compacted;
}

/** Reasoning metadata is transient: it is only required inside an active tool loop. */
export function stripReasoningFromModelMessages(
  messages: Array<Record<string, unknown>> | null,
): Array<Record<string, unknown>> | null {
  if (messages === null) return null;
  return messages.map(
    ({ reasoning: _reasoning, reasoning_details: _details, ...message }) =>
      message,
  );
}
