import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { X, Warning } from "@phosphor-icons/react";

gsap.registerPlugin(useGSAP);

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode | ((helpers: { requestClose: () => void }) => React.ReactNode);
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  isDirty?: boolean;
  discardTitle?: string;
  discardMessage?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = "lg",
  isDirty = false,
  discardTitle = "放弃未保存的修改？",
  discardMessage = "检测到您已修改了表单内容。如果现在离开，所有未保存的输入都将丢失。",
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [touchDeltaY, setTouchDeltaY] = useState(0);
  const touchStartYRef = useRef<number | null>(null);

  // Reset discard confirm whenever modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setShowDiscardConfirm(false);
      setTouchDeltaY(0);
    }
  }, [isOpen]);

  const handleRequestClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else {
          handleRequestClose();
        }
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isDirty, showDiscardConfirm]);

  useGSAP(() => {
    if (isOpen) {
      if (overlayRef.current && modalRef.current) {
        gsap.fromTo(
          overlayRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.2, ease: "power2.out" }
        );
        gsap.fromTo(
          modalRef.current,
          { opacity: 0, scale: 0.96, y: 12 },
          { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: "power3.out" }
        );
      }
    }
  }, { dependencies: [isOpen] });

  // Swipe-down touch gesture handlers (for mobile Bottom Sheet dismiss)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartYRef.current;
    if (diff > 0) {
      // Downward pull with damping resistance
      setTouchDeltaY(Math.min(diff * 0.65, 140));
    }
  };

  const handleTouchEnd = () => {
    if (touchDeltaY > 60) {
      handleRequestClose();
    }
    setTouchDeltaY(0);
    touchStartYRef.current = null;
  };

  if (!isOpen) return null;

  const widthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
  }[maxWidth];

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-hidden sm:overflow-y-auto">
      {/* Full Viewport Backdrop */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={handleRequestClose}
      />

      {/* Dialog Body (Mobile Bottom Sheet / Desktop Dialog) */}
      <div
        ref={modalRef}
        style={{
          transform: touchDeltaY > 0 ? `translateY(${touchDeltaY}px)` : undefined,
          transition: touchDeltaY === 0 ? "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)" : "none",
        }}
        className={`relative w-full ${widthClasses} bg-paper-2 border-t sm:border border-rule rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh] sm:max-h-[calc(100vh-3rem)] my-0 sm:my-auto`}
      >
        {/* Mobile Drag Indicator Handle (iOS/Material Bottom Sheet Pill) */}
        <div
          className="sm:hidden pt-3 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none select-none bg-paper-2 shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          aria-hidden="true"
        >
          <div className="w-10 h-1.5 bg-rule-active/80 hover:bg-rule-active rounded-full transition-colors" />
        </div>

        {/* Pinned Sticky Header */}
        <div
          className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-rule bg-paper-2/95 backdrop-blur flex-shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="min-w-0 pr-2">
            <h3 className="text-sm sm:text-base font-semibold text-ink leading-tight truncate">{title}</h3>
            {subtitle && (
              <p className="text-xs text-ink-muted mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
            className="w-10 h-10 -mr-2 rounded-xl flex items-center justify-center text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors shrink-0 touch-manipulation cursor-pointer"
            aria-label="关闭弹窗"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Children Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto flex-1 min-h-0">{children}</div>

        {/* Pinned Sticky Footer (if provided) */}
        {footer && (
          <div className="shrink-0 px-4 py-3 sm:px-6 sm:py-3.5 border-t border-rule bg-paper-2/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.35)] pb-[calc(env(safe-area-inset-bottom,0px)+12px)] sm:pb-3.5 z-20">
            {typeof footer === "function" ? footer({ requestClose: handleRequestClose }) : footer}
          </div>
        )}

        {/* Action Sheet / Discard Confirmation Overlay (Error Prevention) */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-6 animate-fadeIn">
            <div className="w-full max-w-sm bg-paper-2 border border-rule-active/70 rounded-2xl p-5 shadow-2xl space-y-4 animate-scaleUp">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Warning weight="bold" className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-ink">
                    {discardTitle}
                  </h4>
                  <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                    {discardMessage}
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl bg-paper border border-rule text-xs font-medium text-ink hover:bg-paper-hover transition-colors cursor-pointer touch-manipulation text-center"
                >
                  继续编辑
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer touch-manipulation text-center"
                >
                  放弃修改
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

