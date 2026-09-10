import { Ellipsis } from "lucide-react";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { msgIconBtn, msgIconSize } from "./messageItemStyles";

type Action = {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
};

export function MessageMoreActions({
  actions,
  holdTargetRef,
}: {
  actions: Action[];
  holdTargetRef?: RefObject<HTMLDivElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openMenu = useCallback((anchor: HTMLElement, keyboard = false) => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    const rect = anchor.getBoundingClientRect();
    dialog.dataset.keyboard = String(keyboard);
    dialog.showModal();
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
    const topEdge = (viewport?.offsetTop ?? 0) + 8;
    const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 16;
    const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 16;
    const width = dialog.offsetWidth;
    const height = dialog.offsetHeight;
    const below = rect.bottom + 6;
    const top = below + height <= bottomEdge ? below : rect.top - height - 6;
    dialog.style.left = `${Math.max(leftEdge, Math.min(rect.right - width, rightEdge - width))}px`;
    dialog.style.top = `${Math.max(topEdge, Math.min(top, bottomEdge - height))}px`;
  }, []);

  useEffect(() => {
    const target = holdTargetRef?.current;
    if (!target) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let start: { x: number; y: number } | undefined;
    let opened = false;
    const cancel = () => {
      clearTimeout(timer);
      timer = undefined;
      start = undefined;
      target.classList.remove("message-holding");
    };
    const down = (event: PointerEvent) => {
      cancel();
      opened = false;
      if (
        !event.isPrimary ||
        (event.pointerType !== "touch" && event.pointerType !== "pen")
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest("button, a, input, textarea, pre")
      )
        return;
      start = { x: event.clientX, y: event.clientY };
      target.classList.add("message-holding");
      timer = setTimeout(() => {
        cancel();
        opened = true;
        openMenu(target);
        navigator.vibrate?.(15);
      }, 450);
    };
    const move = (event: PointerEvent) => {
      if (
        start &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10
      )
        cancel();
    };
    const context = (event: MouseEvent) => {
      if (start || opened) event.preventDefault();
    };
    const click = (event: MouseEvent) => {
      if (opened) {
        event.preventDefault();
        event.stopPropagation();
        opened = false;
      }
    };
    target.addEventListener("pointerdown", down);
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", cancel);
    target.addEventListener("pointercancel", cancel);
    target.addEventListener("pointerleave", cancel);
    target.addEventListener("contextmenu", context);
    target.addEventListener("click", click, true);
    return () => {
      cancel();
      target.removeEventListener("pointerdown", down);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", cancel);
      target.removeEventListener("pointercancel", cancel);
      target.removeEventListener("pointerleave", cancel);
      target.removeEventListener("contextmenu", context);
      target.removeEventListener("click", click, true);
    };
  }, [holdTargetRef, openMenu]);

  useEffect(() => {
    // Dismiss on the new press, not a synthesized click after touch release.
    // The release of the hold that opened the menu must leave it open.
    const dismissOutside = (event: PointerEvent) => {
      const dialog = dialogRef.current;
      if (!dialog?.open) return;
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      dialog.close();
    };
    const close = (event: Event) => {
      if (
        event.target instanceof Node &&
        dialogRef.current?.contains(event.target)
      )
        return;
      dialogRef.current?.close();
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.visualViewport?.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.visualViewport?.removeEventListener("resize", close);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        className={msgIconBtn}
        aria-label="More message actions"
        aria-haspopup="dialog"
        onClick={(event) => openMenu(event.currentTarget, event.detail === 0)}
      >
        <Ellipsis size={msgIconSize} />
      </button>
      {createPortal(
        <dialog
          ref={dialogRef}
          className="message-action-popover"
          aria-label="Message actions"
          onKeyDown={(event) => {
            if (event.key === "Tab")
              event.currentTarget.dataset.keyboard = "true";
            if (event.key === "Escape") event.currentTarget.close();
          }}
          onPointerDown={(event) => {
            event.currentTarget.dataset.keyboard = "false";
          }}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={action.disabled}
              className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-accent-ring disabled:opacity-40"
              onClick={() => {
                dialogRef.current?.close();
                action.onSelect();
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </dialog>,
        document.body,
      )}
    </>
  );
}
