import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "../styles";

const VIEW_MARGIN = 8;
const MENU_GAP = 4;

type MenuPosition = {
  top: number;
  left: number;
  flipped: boolean;
};

type Props = {
  anchorRect: DOMRect;
  minWidth?: number;
  onClose: () => void;
  children: ReactNode;
};

export function FloatingOptionsMenu({
  anchorRect,
  minWidth = 140,
  onClose,
  children,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<MenuPosition | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const menu = menuRef.current;

      const menuHeight = menu?.offsetHeight ?? 88;
      const menuWidth = menu?.offsetWidth ?? minWidth;
      const spaceBelow = window.innerHeight - anchorRect.bottom - VIEW_MARGIN;
      const spaceAbove = anchorRect.top - VIEW_MARGIN;
      const flipped =
        spaceBelow < menuHeight &&
        (spaceAbove >= menuHeight || spaceAbove > spaceBelow);

      const idealTop = flipped
        ? anchorRect.top - menuHeight - MENU_GAP
        : anchorRect.bottom + MENU_GAP;
      const top = Math.min(
        window.innerHeight - menuHeight - VIEW_MARGIN,
        Math.max(VIEW_MARGIN, idealTop),
      );
      const left = Math.min(
        Math.max(VIEW_MARGIN, anchorRect.right - menuWidth),
        window.innerWidth - menuWidth - VIEW_MARGIN,
      );

      setPos({ top, left, flipped });
    };

    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
    };
  }, [anchorRect, minWidth]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (menuRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className={cx(
        "ui-animate-slide-up fixed z-[200] rounded-lg border border-border-subtle bg-surface p-1 shadow-[0_10px_28px_rgba(0,0,0,0.4)]",
        pos?.flipped ? "origin-bottom-right" : "origin-top-right",
      )}
      style={
        pos
          ? { top: pos.top, left: pos.left, minWidth }
          : { visibility: "hidden", top: 0, left: 0, minWidth }
      }
      role="menu"
    >
      {children}
    </div>,
    document.body,
  );
}
