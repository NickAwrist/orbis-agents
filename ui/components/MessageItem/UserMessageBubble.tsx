import { Check, Copy, Pencil, RotateCcw, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { CSSProperties } from "react";
import { cx } from "../../styles";
import type { Message } from "../../types";
import { FloatingOptionsMenu } from "../FloatingOptionsMenu";
import { MarkdownMessage } from "../MarkdownMessage";
import { msgIconBtn, msgIconSize, msgIconStroke } from "./messageItemStyles";

const LONG_PRESS_MS = 520;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

const messageActionMenuItem =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[0.8125rem] text-foreground transition-[color,background-color,transform] duration-150 ease-out hover:bg-muted active:scale-[0.99] active:bg-muted/80 disabled:pointer-events-none disabled:opacity-45";

type Props = {
  message: Message;
  messageIndex: number;
  enterStyle: CSSProperties | undefined;
  bubbleRef: RefObject<HTMLDivElement | null>;
  bubbleEditStyle: CSSProperties | undefined;
  isEditingUser: boolean;
  draft: string;
  setDraft: (v: string) => void;
  copied: boolean;
  isBusy: boolean;
  onCancelEditUser: () => void;
  onRequestRetryConfirm: (userIndex: number) => void;
  onRequestEditConfirm: (userIndex: number, text: string) => void;
  beginEdit: () => void;
  copyContent: () => void;
};

export function UserMessageBubble({
  message,
  messageIndex,
  enterStyle,
  bubbleRef,
  bubbleEditStyle,
  isEditingUser,
  draft,
  setDraft,
  copied,
  isBusy,
  onCancelEditUser,
  onRequestRetryConfirm,
  onRequestEditConfirm,
  beginEdit,
  copyContent,
}: Props) {
  const editRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressOpenedRef = useRef(false);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<DOMRect | null>(
    null,
  );

  useEffect(() => {
    if (isEditingUser) {
      editRef.current?.focus();
    }
  }, [isEditingUser]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isEditingUser) setActionMenuAnchor(null);
  }, [isEditingUser]);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  };

  const openActionMenu = (el: HTMLElement) => {
    if (isEditingUser) return;
    setActionMenuAnchor(el.getBoundingClientRect());
  };

  const closeActionMenu = () => {
    longPressOpenedRef.current = false;
    setActionMenuAnchor(null);
  };

  const onMenuRetry = () => {
    closeActionMenu();
    onRequestRetryConfirm(messageIndex);
  };

  const onMenuEdit = () => {
    closeActionMenu();
    beginEdit();
  };

  return (
    <div className="ui-animate-slide-up flex justify-end" style={enterStyle}>
      <div className="group/msg flex w-full min-w-0 flex-col items-end">
        <div
          ref={bubbleRef}
          className={cx(
            "rounded-xl border border-border-subtle bg-muted px-[14px] py-2.5",
            "max-w-[min(85%,36rem)] min-w-0 max-[640px]:max-w-[92%]",
          )}
          style={bubbleEditStyle}
          onPointerDown={(e) => {
            if (
              isEditingUser ||
              (e.pointerType !== "touch" && e.pointerType !== "pen")
            ) {
              return;
            }
            const target = e.currentTarget;
            longPressOpenedRef.current = false;
            clearLongPressTimer();
            longPressStartRef.current = { x: e.clientX, y: e.clientY };
            longPressTimerRef.current = window.setTimeout(() => {
              longPressOpenedRef.current = true;
              openActionMenu(target);
              clearLongPressTimer();
            }, LONG_PRESS_MS);
          }}
          onPointerMove={(e) => {
            const start = longPressStartRef.current;
            if (!start) return;
            const moved =
              Math.abs(e.clientX - start.x) > LONG_PRESS_MOVE_TOLERANCE_PX ||
              Math.abs(e.clientY - start.y) > LONG_PRESS_MOVE_TOLERANCE_PX;
            if (moved) clearLongPressTimer();
          }}
          onPointerUp={clearLongPressTimer}
          onPointerCancel={clearLongPressTimer}
          onPointerLeave={clearLongPressTimer}
          onContextMenu={(e) => {
            if (isEditingUser) return;
            const pointerType =
              "pointerType" in e.nativeEvent
                ? e.nativeEvent.pointerType
                : undefined;
            if (pointerType === "mouse") return;
            e.preventDefault();
            openActionMenu(e.currentTarget);
          }}
          onClickCapture={(e) => {
            if (!longPressOpenedRef.current) return;
            e.preventDefault();
            e.stopPropagation();
            longPressOpenedRef.current = false;
          }}
        >
          {isEditingUser ? (
            <textarea
              ref={editRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(12, Math.max(3, draft.split("\n").length))}
              className="box-border min-h-[4.5rem] w-full max-w-full bg-transparent text-[0.9375rem] leading-[1.5] text-foreground outline-none"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onCancelEditUser();
                }
              }}
            />
          ) : (
            <MarkdownMessage className="text-foreground">
              {message.content}
            </MarkdownMessage>
          )}
        </div>
        {!isEditingUser ? (
          <div
            className={cx(
              "mt-1.5 flex max-w-[min(85%,36rem)] flex-wrap justify-end gap-1 self-end max-[640px]:max-w-[92%]",
              "opacity-0 transition-opacity duration-300 ease-out",
              "group-hover/msg:opacity-100 focus-within:opacity-100",
            )}
          >
            <button
              type="button"
              onClick={() => void copyContent()}
              className={msgIconBtn}
              title={copied ? "Copied" : "Copy"}
              aria-label={copied ? "Copied" : "Copy message"}
            >
              {copied ? (
                <Check size={msgIconSize} strokeWidth={msgIconStroke} />
              ) : (
                <Copy size={msgIconSize} strokeWidth={msgIconStroke} />
              )}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onRequestRetryConfirm(messageIndex)}
              className={msgIconBtn}
              title="Retry"
              aria-label="Retry from this message; later messages will be deleted"
            >
              <RotateCcw size={msgIconSize} strokeWidth={msgIconStroke} />
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={beginEdit}
              className={msgIconBtn}
              title="Edit"
              aria-label="Edit message and retry"
            >
              <Pencil size={msgIconSize} strokeWidth={msgIconStroke} />
            </button>
          </div>
        ) : (
          <div className="mt-1.5 flex max-w-[min(85%,36rem)] flex-wrap justify-end gap-1 self-end max-[640px]:max-w-[92%]">
            <button
              type="button"
              disabled={isBusy}
              onClick={onCancelEditUser}
              className={msgIconBtn}
              title="Cancel editing"
              aria-label="Cancel editing"
            >
              <X size={msgIconSize} strokeWidth={msgIconStroke} />
            </button>
            <button
              type="button"
              disabled={isBusy || !draft.trim()}
              onClick={() => onRequestEditConfirm(messageIndex, draft.trim())}
              className={msgIconBtn}
              title="Save and retry"
              aria-label="Save edits and retry; later messages will be deleted"
            >
              <Send size={msgIconSize} strokeWidth={msgIconStroke} />
            </button>
          </div>
        )}
        {actionMenuAnchor && !isEditingUser && (
          <FloatingOptionsMenu
            anchorRect={actionMenuAnchor}
            minWidth={150}
            onClose={closeActionMenu}
          >
            <button
              type="button"
              onClick={onMenuRetry}
              disabled={isBusy}
              className={messageActionMenuItem}
              role="menuitem"
            >
              <RotateCcw size={14} />
              Retry
            </button>
            <button
              type="button"
              onClick={onMenuEdit}
              disabled={isBusy}
              className={messageActionMenuItem}
              role="menuitem"
            >
              <Pencil size={14} />
              Edit
            </button>
          </FloatingOptionsMenu>
        )}
      </div>
    </div>
  );
}
