import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { cx } from "../../styles";
import type { SessionSummary } from "../../types";
import { FloatingOptionsMenu } from "../FloatingOptionsMenu";

type Props = {
  session: SessionSummary;
  active: boolean;
  collapsed: boolean;
  openMenu: { id: string; anchorRect: DOMRect } | null;
  setOpenMenu: (menu: { id: string; anchorRect: DOMRect } | null) => void;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
};

export function SessionListItem({
  session,
  active,
  collapsed,
  openMenu,
  setOpenMenu,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
}: Props) {
  const menuOpen = openMenu?.id === session.id;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => onSelectSession(session.id)}
        className={cx(
          "relative flex w-full justify-center rounded-md px-2 py-2 text-left transition-[color,background-color,transform] duration-150 ease-out hover:bg-muted active:scale-[0.98]",
          active &&
            "before:pointer-events-none before:absolute before:left-1 before:top-1/2 before:h-5 before:w-px before:-translate-y-1/2 before:rounded-full before:bg-foreground/45 before:content-['']",
        )}
        title={session.preview || "Run"}
      >
        <div className="min-w-0">
          <div
            className={cx(
              "size-1.5 rounded-full bg-muted-foreground/55 transition-[background-color,opacity] duration-150",
              active && "bg-foreground/50",
            )}
          />
        </div>
      </button>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_32px] items-stretch border-b border-border-subtle last:border-b-0">
      <button
        type="button"
        onClick={() => {
          setOpenMenu(null);
          onSelectSession(session.id);
        }}
        className={cx(
          "relative block w-full rounded-none rounded-l-md border-l-2 border-transparent bg-transparent px-2 py-2.5 pr-1 text-left transition-[color,background-color,border-color,transform] duration-150 ease-out hover:bg-muted active:scale-[0.995]",
          active && "border-l-foreground/35 bg-muted/20 hover:bg-muted/35",
        )}
      >
        <div className="min-w-0">
          <div className="overflow-hidden text-[0.8125rem] leading-[1.4] text-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {session.preview || "New run"}
          </div>
          <div className="mt-1 text-[0.6875rem] text-muted-foreground">
            {new Date(session.updatedAt).toLocaleString()}
          </div>
        </div>
      </button>
      <div className="relative flex items-start justify-center pr-0.5 pt-2">
        <button
          type="button"
          className={cx(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-transparent text-muted-foreground transition-[color,background-color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.94] active:bg-muted/70",
            menuOpen && "bg-muted text-foreground",
          )}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Run options"
          onClick={(e) => {
            e.stopPropagation();
            if (menuOpen) {
              setOpenMenu(null);
              return;
            }
            setOpenMenu({
              id: session.id,
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
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[0.8125rem] text-foreground transition-[color,background-color,transform] duration-150 ease-out hover:bg-muted active:scale-[0.99] active:bg-muted/80"
              role="menuitem"
              onClick={() => {
                setOpenMenu(null);
                onRenameSession(session.id);
              }}
            >
              <Pencil size={14} />
              Rename
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[0.8125rem] text-red-400 transition-[color,background-color,transform] duration-150 ease-out hover:bg-red-400/10 hover:text-red-300 active:scale-[0.99] active:bg-red-400/15"
              role="menuitem"
              onClick={() => {
                setOpenMenu(null);
                onDeleteSession(session.id);
              }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </FloatingOptionsMenu>
        )}
      </div>
    </div>
  );
}
