import type { MessageStep } from "../../types";

export type StreamBuffer = {
  content: string;
  thinking: string;
  step: MessageStep | null;
  steps: MessageStep[];
};

export function createEmptyStreamBuffer(): StreamBuffer {
  return { content: "", thinking: "", step: null, steps: [] };
}
