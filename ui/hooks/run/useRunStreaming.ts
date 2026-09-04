import {
  type Dispatch,
  type FormEvent,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ImageAttachment } from "../../../src/attachments/types";
import type { AgentData } from "../../persist/agents";
import { patchSessionApi } from "../../persist/sessions";
import { userScopedFetch } from "../../persist/userIdentity";
import type { UserSettings } from "../../persist/userSettings";
import type {
  DebugData,
  Message,
  MessageStep,
  PendingApproval,
  TruncateConfirmState,
} from "../../types";
import { executeRunTurn } from "./executeRunTurn";
import type { RunFlightApi } from "./runTypes";
import { createEmptyStreamBuffer } from "./streamBuffer";
import { usePendingImages } from "./usePendingImages";
import { useRunDebug } from "./useRunDebug";
import { useRunFlight } from "./useRunFlight";
import { useRunResume } from "./useRunResume";
import { useTurnBuffer } from "./useTurnBuffer";

type Args = {
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  activeSessionId: string | null;
  activeSessionIdRef: MutableRefObject<string | null>;
  isEphemeralRef: MutableRefObject<boolean>;
  userSettingsRef: MutableRefObject<UserSettings>;
  selectedSessionAgentRef: MutableRefObject<string>;
  agentMapRef: MutableRefObject<Map<string, AgentData>>;
  workspaceDisplayPath: string;
  modelMessagesRef: MutableRefObject<Array<Record<string, unknown>> | null>;
  debugOpenRef: MutableRefObject<boolean>;
  debugOpen: boolean;
  setDebugOpen: Dispatch<SetStateAction<boolean>>;
  setDebugData: Dispatch<SetStateAction<DebugData | null>>;
  selectedModel: string;
  modelSendReady: boolean;
  refreshSessions: () => Promise<void>;
  fetchOllamaHealth: () => Promise<void>;
  bindStreamingReset: (fn: () => void) => void;
  setEditingUserIndex: Dispatch<SetStateAction<number | null>>;
  truncateConfirm: TruncateConfirmState;
  setTruncateConfirm: Dispatch<SetStateAction<TruncateConfirmState>>;
  runFlightRef: MutableRefObject<RunFlightApi | null>;
  supportsImageInput: boolean;
  isEphemeral: boolean;
};

export function useRunStreaming(p: Args) {
  const [input, setInput] = useState("");
  const [streamingStep, setStreamingStep] = useState<MessageStep | null>(null);
  const [streamingSteps, setStreamingSteps] = useState<MessageStep[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingThinking, setStreamingThinking] = useState("");
  const [runPending, setRunPending] = useState(false);
  const [pendingApproval, setPendingApproval] =
    useState<PendingApproval | null>(null);

  const rawRunPendingRef = useRef(false);
  const inFlightSessionIdRef = useRef<string | null>(null);
  const inFlightEphemeralRef = useRef(false);
  const {
    streamBufferRef,
    turnMessagesSnapshotRef,
    turnRootAgentNameRef,
    resetStreamBuffers,
  } = useTurnBuffer();

  p.debugOpenRef.current = p.debugOpen;

  const clearStreamingUi = useCallback(() => {
    setStreamingStep(null);
    setStreamingSteps([]);
    setStreamingContent("");
    setStreamingThinking("");
  }, []);

  useLayoutEffect(() => {
    p.bindStreamingReset(() => {
      clearStreamingUi();
      resetStreamBuffers();
    });
  }, [p.bindStreamingReset, clearStreamingUi, resetStreamBuffers]);

  const {
    abortControllerRef,
    activeRequestIdRef,
    inFlightSessionId,
    setInFlightSessionId,
    reconnectToStream,
  } = useRunFlight(
    {
      activeSessionIdRef: p.activeSessionIdRef,
      modelMessagesRef: p.modelMessagesRef,
      selectedSessionAgentRef: p.selectedSessionAgentRef,
      setMessages: p.setMessages,
      refreshSessions: p.refreshSessions,
      streamBufferRef,
      setStreamingStep,
      setStreamingSteps,
      setStreamingContent,
      setStreamingThinking,
      setRunPending,
      setPendingApproval,
    },
    p.runFlightRef,
    rawRunPendingRef,
    inFlightSessionIdRef,
    inFlightEphemeralRef,
    turnMessagesSnapshotRef,
  );

  useRunResume({
    abortControllerRef,
    activeSessionIdRef: p.activeSessionIdRef,
    isEphemeralRef: p.isEphemeralRef,
    modelMessagesRef: p.modelMessagesRef,
    rawRunPendingRef,
    inFlightSessionIdRef,
    reconnectToStream,
    setMessages: p.setMessages,
    clearStreamingUi,
    refreshSessions: p.refreshSessions,
  });

  const fetchDebugData = useRunDebug({
    agentMapRef: p.agentMapRef,
    selectedSessionAgentRef: p.selectedSessionAgentRef,
    workspaceDisplayPath: p.workspaceDisplayPath,
    userSettingsRef: p.userSettingsRef,
    isEphemeralRef: p.isEphemeralRef,
    setDebugData: p.setDebugData,
  });

  const images = usePendingImages({
    activeSessionId: p.activeSessionId,
    supportsImageInput: p.supportsImageInput,
    isEphemeral: p.isEphemeral,
  });

  const runTurn = (
    sessionId: string,
    priorMessages: Message[],
    message: string,
    attachments: ImageAttachment[],
    options: { rebuildModelMessages: boolean },
  ) =>
    executeRunTurn(
      {
        activeSessionIdRef: p.activeSessionIdRef,
        isEphemeralRef: p.isEphemeralRef,
        selectedSessionAgentRef: p.selectedSessionAgentRef,
        userSettingsRef: p.userSettingsRef,
        modelMessagesRef: p.modelMessagesRef,
        debugOpenRef: p.debugOpenRef,
        modelSendReady: p.modelSendReady,
        selectedModel: p.selectedModel,
        setMessages: p.setMessages,
        refreshSessions: p.refreshSessions,
      },
      {
        abortControllerRef,
        activeRequestIdRef,
        inFlightSessionIdRef,
        inFlightEphemeralRef,
        rawRunPendingRef,
        turnRootAgentNameRef,
        streamBufferRef,
        turnMessagesSnapshotRef,
        setInFlightSessionId,
        setRunPending,
        setStreamingStep,
        setStreamingSteps,
        setStreamingContent,
        setStreamingThinking,
        setPendingApproval,
        clearStreamingUi,
        reconnectToStream,
        fetchDebugData,
      },
      sessionId,
      priorMessages,
      message,
      attachments,
      options,
    );

  const stopGeneration = () => {
    const controller = abortControllerRef.current;
    if (!controller) return;

    const requestId = activeRequestIdRef.current;
    const sessionId = inFlightSessionIdRef.current;
    const ephemeral = inFlightEphemeralRef.current;
    if (requestId) {
      void userScopedFetch("/api/runs/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      }).catch(() => {});
    }

    controller.abort();
    abortControllerRef.current = null;
    activeRequestIdRef.current = null;
    inFlightSessionIdRef.current = null;
    inFlightEphemeralRef.current = false;
    rawRunPendingRef.current = false;
    streamBufferRef.current = createEmptyStreamBuffer();
    turnMessagesSnapshotRef.current = null;
    setInFlightSessionId(null);
    setRunPending(false);
    clearStreamingUi();
    setPendingApproval(null);

    p.setMessages((current) => {
      if (!sessionId || p.activeSessionIdRef.current !== sessionId) {
        return current;
      }
      const halted: Message[] = [
        ...current,
        { role: "assistant", content: "*Response halted by user.*" },
      ];
      if (!ephemeral) {
        void patchSessionApi(sessionId, { history: halted }).catch((error) =>
          console.error(error),
        );
      }
      return halted;
    });
  };

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const sessionId = p.activeSessionId;
    const message = input.trim();
    if (!message || !sessionId || !p.modelSendReady) return;
    if (images.pendingImages.length > 0 && !images.canAttachImages) {
      images.setImageError(
        !p.supportsImageInput
          ? "The selected model does not accept images."
          : "Images are not available in temporary sessions.",
      );
      return;
    }

    const attachments = await images.uploadPendingImages(sessionId);
    if (!attachments) return;
    setInput("");
    images.clearPendingImages();
    await runTurn(sessionId, p.messages, message, attachments, {
      rebuildModelMessages: false,
    });
  };

  const confirmTruncateAndRetry = async () => {
    const confirmation = p.truncateConfirm;
    p.setTruncateConfirm(null);
    p.setEditingUserIndex(null);
    const sessionId = p.activeSessionId;
    if (!confirmation || !sessionId) return;
    const row = p.messages[confirmation.userIndex];
    if (!row || row.role !== "user") return;
    const message =
      confirmation.kind === "edit" ? confirmation.text : row.content;
    if (!message.trim()) return;
    await runTurn(
      sessionId,
      p.messages.slice(0, confirmation.userIndex),
      message,
      row.attachments?.filter(
        (attachment): attachment is ImageAttachment =>
          attachment.kind === "image",
      ) ?? [],
      { rebuildModelMessages: true },
    );
  };

  const toggleDebug = () => {
    if (!p.debugOpen && p.activeSessionId) {
      void p.fetchOllamaHealth();
      void fetchDebugData(p.activeSessionId);
    }
    p.setDebugOpen((open) => !open);
  };

  const resolveApproval = async (approved: boolean) => {
    const approval = pendingApproval;
    if (!approval) return;
    setPendingApproval(null);
    const response = await userScopedFetch(
      `/api/runs/${encodeURIComponent(approval.requestId)}/approvals/${encodeURIComponent(approval.approvalId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      },
    );
    if (!response.ok && response.status !== 404) {
      console.error("Failed to resolve approval");
    }
  };

  const sessionRunBusy =
    images.uploadPending ||
    ((runPending || streamingStep !== null || streamingSteps.length > 0) &&
      inFlightSessionId !== null &&
      inFlightSessionId === p.activeSessionId);

  return {
    input,
    setInput,
    streamingStep,
    streamingSteps,
    streamingContent,
    streamingThinking,
    runPending: sessionRunBusy,
    stopGeneration,
    sendMessage,
    confirmTruncateAndRetry,
    toggleDebug,
    pendingApproval,
    resolveApproval,
    pendingImages: images.pendingImages,
    imageError: images.imageError,
    addPendingImages: images.addPendingImages,
    removePendingImage: images.removePendingImage,
    canAttachImages: images.canAttachImages,
    attachmentsSendReady: images.attachmentsSendReady,
    attachImageDisabledReason: images.attachImageDisabledReason,
  };
}
