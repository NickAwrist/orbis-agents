import { Bug, Check, Copy, EyeOff, PanelLeft } from "lucide-react";
import { useState } from "react";
import { cx, iconButton } from "../styles";

type RunAppHeaderProps = {
  activeSessionId: string | null;
  sidebarOpen: boolean;
  sidebarCollapsed?: boolean;
  onOpenSidebar: () => void;
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
  sidebarCollapsed = false,
  onOpenSidebar,
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
        "min-[1320px]:transition-[padding-left] min-[1320px]:duration-300 min-[1320px]:ease-[cubic-bezier(0.22,1,0.36,1)]",
        !sidebarCollapsed && "min-[1320px]:pl-[calc(260px+1rem)]",
        activeSessionId &&
          "border-b border-border-subtle/60 bg-background/[0.16] shadow-[0_1px_0_0_rgba(255,255,255,0.03)] backdrop-blur-xl backdrop-saturate-125",
      )}
    >
      <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onOpenSidebar}
          className={cx(
            iconButton,
            "shrink-0",
            !sidebarCollapsed && "min-[901px]:hidden",
          )}
          title={sidebarCollapsed ? "Expand sidebar" : "Open chats"}
          aria-expanded={sidebarOpen || !sidebarCollapsed}
          aria-controls="app-sidebar"
        >
          <PanelLeft size={18} />
        </button>
        {activeSessionId && isEphemeral && (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-amber-400">
            <EyeOff size={12} />
            Ephemeral
          </span>
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
            title={debugOpen ? "Hide debug inspector" : "Debug inspector"}
            aria-label={debugOpen ? "Hide debug inspector" : "Debug inspector"}
          >
            <Bug size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
