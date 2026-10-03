import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  cloneElement,
  isValidElement,
} from "react";
import { createPortal } from "react-dom";

export type TooltipSide = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: React.ReactNode;
  side?: TooltipSide;
  delay?: number;
  className?: string;
  disabled?: boolean;
  children: React.ReactElement;
}

interface TooltipState {
  visible: boolean;
  content: React.ReactNode;
  side: TooltipSide;
  actualSide: TooltipSide;
  x: number;
  y: number;
  arrowOffset: number;
  className?: string;
}

interface TooltipShowOptions {
  target: HTMLElement;
  content: React.ReactNode;
  side?: TooltipSide;
  delay?: number;
  className?: string;
}

type Listener = (state: TooltipState) => void;

class TooltipManager {
  private activeTarget: HTMLElement | null = null;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private warmTimer: ReturnType<typeof setTimeout> | null = null;
  private isWarm = false;
  private listeners: Set<Listener> = new Set();
  private currentState: TooltipState = {
    visible: false,
    content: null,
    side: "top",
    actualSide: "top",
    x: 0,
    y: 0,
    arrowOffset: 0,
  };

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(state: TooltipState) {
    this.currentState = state;
    this.listeners.forEach((l) => l(state));
  }

  show(options: TooltipShowOptions) {
    const { target, content, side = "top", delay = 120, className } = options;
    if (!content) return;

    if (this.activeTarget === target && this.currentState.visible) {
      return;
    }

    this.clearTimers();
    this.activeTarget = target;

    const executeShow = () => {
      if (!this.activeTarget || !this.activeTarget.isConnected) return;
      this.isWarm = true;

      // Position calculation will be finalized after measuring
      this.notify({
        visible: true,
        content,
        side,
        actualSide: side,
        x: -9999,
        y: -9999,
        arrowOffset: 0,
        className,
      });
    };

    if (this.isWarm) {
      executeShow();
    } else {
      this.showTimer = setTimeout(executeShow, delay);
    }
  }

  updatePosition(tooltipEl: HTMLElement) {
    if (!this.activeTarget || !this.activeTarget.isConnected || !this.currentState.visible) {
      return;
    }

    const targetRect = this.activeTarget.getBoundingClientRect();
    const tipRect = tooltipEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const GAP = 7;
    const side = this.currentState.side;

    let actualSide = side;
    if (side === "top" && targetRect.top - tipRect.height - GAP < 6) {
      actualSide = "bottom";
    } else if (side === "bottom" && targetRect.bottom + tipRect.height + GAP > vh - 6) {
      actualSide = "top";
    } else if (side === "left" && targetRect.left - tipRect.width - GAP < 6) {
      actualSide = "right";
    } else if (side === "right" && targetRect.right + tipRect.width + GAP > vw - 6) {
      actualSide = "left";
    }

    let x = 0;
    let y = 0;
    let arrowOffset = 0;

    if (actualSide === "top" || actualSide === "bottom") {
      if (actualSide === "top") {
        y = targetRect.top - tipRect.height - GAP;
      } else {
        y = targetRect.bottom + GAP;
      }

      const targetCenterX = targetRect.left + targetRect.width / 2;
      const desiredX = targetCenterX - tipRect.width / 2;
      const minX = 8;
      const maxX = vw - tipRect.width - 8;
      x = Math.max(minX, Math.min(maxX, desiredX));

      arrowOffset = targetCenterX - x;
      arrowOffset = Math.max(10, Math.min(tipRect.width - 10, arrowOffset));
    } else {
      if (actualSide === "left") {
        x = targetRect.left - tipRect.width - GAP;
      } else {
        x = targetRect.right + GAP;
      }

      const targetCenterY = targetRect.top + targetRect.height / 2;
      const desiredY = targetCenterY - tipRect.height / 2;
      const minY = 8;
      const maxY = vh - tipRect.height - 8;
      y = Math.max(minY, Math.min(maxY, desiredY));

      arrowOffset = targetCenterY - y;
      arrowOffset = Math.max(10, Math.min(tipRect.height - 10, arrowOffset));
    }

    this.notify({
      ...this.currentState,
      actualSide,
      x: Math.round(x),
      y: Math.round(y),
      arrowOffset: Math.round(arrowOffset),
    });
  }

  hide() {
    this.clearTimers();
    this.activeTarget = null;

    if (this.currentState.visible) {
      this.notify({
        ...this.currentState,
        visible: false,
      });

      this.warmTimer = setTimeout(() => {
        this.isWarm = false;
      }, 350);
    }
  }

  private clearTimers() {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
    if (this.warmTimer) {
      clearTimeout(this.warmTimer);
      this.warmTimer = null;
    }
  }
}

export const tooltipManager = new TooltipManager();

/**
 * Declarative Tooltip wrapper component.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  side = "top",
  delay = 120,
  disabled = false,
  className = "",
  children,
}) => {
  if (disabled || !content) return children;

  const childProps = isValidElement(children) ? (children.props as Record<string, any>) : undefined;

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    childProps?.onMouseEnter?.(e);
    if (e.defaultPrevented) return;
    tooltipManager.show({
      target: e.currentTarget,
      content,
      side,
      delay,
      className,
    });
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    childProps?.onMouseLeave?.(e);
    tooltipManager.hide();
  };

  const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    childProps?.onFocus?.(e);
    tooltipManager.show({
      target: e.currentTarget,
      content,
      side,
      delay: 50,
      className,
    });
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    childProps?.onBlur?.(e);
    tooltipManager.hide();
  };

  if (isValidElement(children) && childProps) {
    const newProps: Record<string, any> = {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onFocus: handleFocus,
      onBlur: handleBlur,
    };
    if (childProps.title) {
      if (!childProps["aria-label"]) {
        newProps["aria-label"] = childProps.title;
      }
      newProps.title = undefined;
    }
    return cloneElement(children, newProps);
  }

  return (
    <span
      className="inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children}
    </span>
  );
};

/**
 * Global Tooltip Viewport Portal & Native Title Interceptor.
 * Mount once in App.tsx.
 */
export const GlobalTooltip: React.FC = () => {
  const [state, setState] = useState<TooltipState>({
    visible: false,
    content: null,
    side: "top",
    actualSide: "top",
    x: 0,
    y: 0,
    arrowOffset: 0,
  });

  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return tooltipManager.subscribe((s) => setState(s));
  }, []);

  // Recalculate position once DOM elements are rendered
  useEffect(() => {
    if (state.visible && tipRef.current) {
      tooltipManager.updatePosition(tipRef.current);
    }
  }, [state.visible, state.content]);

  // Global listeners: intercept [title] and handle [data-tooltip], hide on scroll / click
  useEffect(() => {
    const handlePointerOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.("[data-tooltip], [title]") as HTMLElement | null;
      if (!target) return;

      // Intercept and strip native title attribute to prevent browser default tooltip popup
      if (target.hasAttribute("title")) {
        const titleVal = target.getAttribute("title");
        if (titleVal && titleVal.trim()) {
          target.setAttribute("data-tooltip", titleVal.trim());
          if (!target.getAttribute("aria-label")) {
            target.setAttribute("aria-label", titleVal.trim());
          }
        }
        target.removeAttribute("title");
      }

      const tooltipText = target.getAttribute("data-tooltip");
      if (!tooltipText) return;

      const side = (target.getAttribute("data-tooltip-side") as TooltipSide) || "top";
      tooltipManager.show({
        target,
        content: tooltipText,
        side,
      });
    };

    const handlePointerOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.("[data-tooltip]") as HTMLElement | null;
      if (!target) return;

      const related = e.relatedTarget as HTMLElement | null;
      if (related && target.contains(related)) {
        return;
      }

      tooltipManager.hide();
    };

    const handleHide = () => {
      tooltipManager.hide();
    };

    document.addEventListener("mouseover", handlePointerOver, { passive: true });
    document.addEventListener("mouseout", handlePointerOut, { passive: true });
    window.addEventListener("scroll", handleHide, { passive: true, capture: true });
    window.addEventListener("pointerdown", handleHide, { passive: true });
    window.addEventListener("keydown", handleHide, { passive: true });

    return () => {
      document.removeEventListener("mouseover", handlePointerOver);
      document.removeEventListener("mouseout", handlePointerOut);
      window.removeEventListener("scroll", handleHide, { capture: true });
      window.removeEventListener("pointerdown", handleHide);
      window.removeEventListener("keydown", handleHide);
    };
  }, []);

  if (!state.visible || !state.content) return null;

  const renderArrow = () => {
    const base = "absolute w-2 h-2 bg-paper-3";
    switch (state.actualSide) {
      case "top":
        return (
          <div
            className={`${base} border-r border-b border-rule-active/50`}
            style={{
              bottom: "-4px",
              left: `${state.arrowOffset}px`,
              transform: "translateX(-50%) rotate(45deg)",
            }}
          />
        );
      case "bottom":
        return (
          <div
            className={`${base} border-l border-t border-rule-active/50`}
            style={{
              top: "-4px",
              left: `${state.arrowOffset}px`,
              transform: "translateX(-50%) rotate(45deg)",
            }}
          />
        );
      case "left":
        return (
          <div
            className={`${base} border-r border-t border-rule-active/50`}
            style={{
              right: "-4px",
              top: `${state.arrowOffset}px`,
              transform: "translateY(-50%) rotate(45deg)",
            }}
          />
        );
      case "right":
        return (
          <div
            className={`${base} border-l border-b border-rule-active/50`}
            style={{
              left: "-4px",
              top: `${state.arrowOffset}px`,
              transform: "translateY(-50%) rotate(45deg)",
            }}
          />
        );
    }
  };

  return createPortal(
    <div
      ref={tipRef}
      className={`fixed pointer-events-none z-[99999] select-none text-xs font-sans text-ink bg-paper-3/95 backdrop-blur-md px-2.5 py-1 rounded-md border border-rule-active/50 shadow-xl shadow-black/70 tooltip-animate ${
        state.className || ""
      }`}
      style={{
        left: `${state.x}px`,
        top: `${state.y}px`,
        visibility: state.x === -9999 ? "hidden" : "visible",
      }}
    >
      <div className="relative z-10 font-medium tracking-tight whitespace-nowrap">
        {state.content}
      </div>
      {renderArrow()}
    </div>,
    document.body
  );
};
