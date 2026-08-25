import { useCallback, useRef } from "react";
import type { Message } from "../../types";
import { createEmptyStreamBuffer } from "./streamBuffer";

/** Refs for streaming token accumulation and reconnect hydration. */
export function useTurnBuffer() {
  const streamBufferRef = useRef(createEmptyStreamBuffer());
  const turnMessagesSnapshotRef = useRef<Message[] | null>(null);
  const turnRootAgentNameRef = useRef("");

  const resetStreamBuffers = useCallback(() => {
    streamBufferRef.current = createEmptyStreamBuffer();
  }, []);

  return {
    streamBufferRef,
    turnMessagesSnapshotRef,
    turnRootAgentNameRef,
    resetStreamBuffers,
  };
}
