import { Bug, Check, Copy, EyeOff, PanelLeft, X } from "lucide-react";
import { useState } from "react";
import { cx, iconButton } from "../styles";
import type { ModelOption } from "../types";
import { AgentSelectBar } from "./AgentSelectBar";
import { ModelSelectBar } from "./ModelSelectBar";

type RunAppHeaderProps = {
  activeSessionId: string | null;
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  ollamaModels: ModelOption[];
  ollamaConnected: boolean | null;
  modelsLoadError: string | null;
  selectedModel: string;
  onModelChange: (model: string) => void;
  runAgents: { name: string }[];
  selectedSessionAgent: string;
  onSessionAgentChange: (name: string) => void;
  headerRunBusy: boolean;
  debugOpen: boolean;
  onToggleDebug: () => void;
  onCopyEntireRun?: () => Promise<boolean>;
  isEphemeral?: boolean;
};

/* ------------------------------------------------------------------ */
/*  Header                                                            */
/* ------------------------------------------------------------------ */

export function RunAppHeader({
  activeSessionId,
  sidebarOpen,
  onOpenSidebar,
  ollamaModels,
  ollamaConnected,
  modelsLoadError,
  selectedModel,
  onModelChange,
  runAgents,
  selectedSessionAgent,
  onSessionAgentChange,
  headerRunBusy,
  debugOpen,
  onToggleDebug,
  onCopyEntireRun,
  isEphemeral,
}: RunAppHeaderProps) {
  const [runCopied, setRunCopied] = useState(false);

  const handleCopyRun = async () => {
    if (!onCopyEntireRun) return;
    const ok = await onCopyEntireRun();
    if (ok) {
      setRunCopied(true);
      window.setTimeout(() => setRunCopied(false), 1500);
    }
  };

  return (
    <div
      className={cx(
        "pointer-events-none absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-between gap-3 px-4 max-[640px]:h-[52px] max-[640px]:px-3.5",
        activeSessionId &&
          "border-b border-border-subtle/60 bg-background/[0.16] shadow-[0_1px_0_0_rgba(255,255,255,0.03)] backdrop-blur-xl backdrop-saturate-125",
      )}
    >
      <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onOpenSidebar}
          className={cx(iconButton, "shrink-0 min-[901px]:hidden")}
          title="Open chats"
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
        >
          <PanelLeft size={18} />
        </button>
        {activeSessionId && (
          <div className="flex min-w-0 items-center gap-1.5">
            {isEphemeral && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-amber-400">
                <EyeOff size={12} />
                Ephemeral
              </span>
            )}
            <ModelSelectBar
              ollamaModels={ollamaModels}
              ollamaConnected={ollamaConnected}
              modelsLoadError={modelsLoadError}
              selectedModel={selectedModel}
              onModelChange={onModelChange}
              disabled={headerRunBusy}
            />
            <AgentSelectBar
              agents={runAgents}
              selectedAgent={selectedSessionAgent}
              onAgentChange={onSessionAgentChange}
              disabled={headerRunBusy}
            />
          </div>
        )}
      </div>
      <div className="pointer-events-auto flex shrink-0 items-center gap-1">
        {activeSessionId && onCopyEntireRun && (
          <button
            type="button"
            onClick={() => void handleCopyRun()}
            className={cx(iconButton)}
            title={runCopied ? "Copied" : "Copy entire chat"}
            aria-label={runCopied ? "Copied" : "Copy entire chat"}
          >
            {runCopied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        )}
        {activeSessionId && (
          <button
            type="button"
            onClick={onToggleDebug}
            className={cx(iconButton)}
            title="Debug"
            aria-pressed={debugOpen}
          >
            {debugOpen ? <X size={18} /> : <Bug size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}
