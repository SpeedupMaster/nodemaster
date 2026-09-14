import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

interface RollingCounterProps {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}

export const RollingCounter: React.FC<RollingCounterProps> = ({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  duration = 0.8,
  className = "",
}) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const currentValRef = useRef({ val: value });

  useGSAP(() => {
    if (!spanRef.current) return;
    gsap.to(currentValRef.current, {
      val: value,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        if (spanRef.current) {
          const formatted = currentValRef.current.val.toFixed(decimals);
          spanRef.current.textContent = `${prefix}${formatted}${suffix}`;
        }
      },
    });
  }, { dependencies: [value, decimals, suffix, prefix, duration] });

  return (
    <span ref={spanRef} className={`font-mono tabular-nums ${className}`}>
      {prefix}{value.toFixed(decimals)}{suffix}
    </span>
  );
};
