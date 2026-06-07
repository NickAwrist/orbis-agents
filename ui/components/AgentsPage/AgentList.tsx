import { Bot, MoreVertical, Plus, Trash2 } from "lucide-react";
import type { AgentData } from "../../persist/agents";
import { cx, eyebrowText } from "../../styles";
import { FloatingOptionsMenu } from "../FloatingOptionsMenu";
import { canDeleteAgent } from "./agentsPageUtils";

type Props = {
  agents: AgentData[];
  selectedId: string | null;
  isNew: boolean;
  openMenu: { id: string; anchorRect: DOMRect } | null;
  setOpenMenu: (menu: { id: string; anchorRect: DOMRect } | null) => void;
  deleting: boolean;
  onSelectAgent: (a: AgentData) => void;
  onStartNew: () => void;
  onRequestDeleteAgent: (a: AgentData) => void;
};

export function AgentList({
  agents,
  selectedId,
  isNew,
  openMenu,
  setOpenMenu,
  deleting,
  onSelectAgent,
  onStartNew,
  onRequestDeleteAgent,
}: Props) {
  return (
    <div className="flex min-h-0 flex-col border-r border-border-subtle max-[700px]:border-b max-[700px]:border-r-0">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <span className={eyebrowText}>Agents</span>
        <button
          type="button"
          onClick={onStartNew}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.75rem] font-medium text-accent transition-colors hover:bg-muted"
        >
          <Plus size={14} />
          New
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {agents.map((a) => {
          const deletable = canDeleteAgent(a);
          const active = selectedId === a.id && !isNew;
          const menuOpen = openMenu?.id === a.id;
          return (
            <div
              key={a.id}
              className={cx(
                "group mb-0.5 grid items-stretch rounded-lg transition-colors duration-150",
                deletable ? "grid-cols-[minmax(0,1fr)_32px]" : "grid-cols-1",
                active ? "bg-muted/50" : "hover:bg-muted/30",
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onSelectAgent(a);
                }}
                className={cx(
                  "flex min-w-0 items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-150",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Bot size={15} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[0.8125rem] font-medium">
                    {a.name}
                  </div>
                  <div className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground">
                    {a.description || "No description"}
                  </div>
                </div>
              </button>
              {deletable && (
                <div className="relative flex items-start justify-center pr-0.5 pt-2 max-[700px]:opacity-100 md:opacity-0 md:transition-opacity md:duration-150 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                  <button
                    type="button"
                    className={cx(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-transparent text-muted-foreground transition-[color,background-color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.94] active:bg-muted/70 max-[700px]:opacity-100",
                      menuOpen && "bg-muted text-foreground md:opacity-100",
                    )}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    aria-label="Agent options"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (menuOpen) {
                        setOpenMenu(null);
                        return;
                      }
                      setOpenMenu({
                        id: a.id,
                        anchorRect: e.currentTarget.getBoundingClientRect(),
                      });
                    }}
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuOpen && (
                    <FloatingOptionsMenu
                      anchorRect={openMenu.anchorRect}
                      onClose={() => setOpenMenu(null)}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[0.8125rem] text-red-400 transition-[color,background-color,transform] duration-150 ease-out hover:bg-red-400/10 hover:text-red-300 active:scale-[0.99] active:bg-red-400/15"
                        role="menuitem"
                        disabled={deleting}
                        onClick={() => {
                          setOpenMenu(null);
                          onRequestDeleteAgent(a);
                        }}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </FloatingOptionsMenu>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
