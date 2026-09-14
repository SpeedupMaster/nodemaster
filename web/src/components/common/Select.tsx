import React, { useState, useRef, useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { CaretDown, Check } from "@phosphor-icons/react";

gsap.registerPlugin(useGSAP);

export interface SelectOption {
  value: string;
  label: string;
  desc?: string;
  badge?: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "请选择...",
  disabled = false,
  className = "",
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // GSAP animation for dropdown menu
  useGSAP(() => {
    if (isOpen && menuRef.current) {
      gsap.fromTo(
        menuRef.current,
        { opacity: 0, y: -4, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.16, ease: "power2.out" }
      );
    }
  }, { dependencies: [isOpen] });

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} id={id}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-md bg-paper border transition-all text-xs select-none cursor-pointer focus:outline-none ${
          isOpen
            ? "border-accent ring-1 ring-accent/30 bg-paper-hover"
            : "border-rule hover:border-rule-active hover:bg-paper-hover"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-center gap-2 truncate">
          <span className={`truncate ${selectedOption ? "text-ink font-medium" : "text-ink-muted"}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 text-ink-secondary border border-rule font-mono">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <CaretDown
          weight="bold"
          className={`w-3.5 h-3.5 text-ink-muted transition-transform duration-200 flex-shrink-0 ${
            isOpen ? "rotate-180 text-accent" : ""
          }`}
        />
      </button>

      {/* Custom Dropdown Popover */}
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute left-0 right-0 top-full mt-1 bg-paper-2 border border-rule rounded-md shadow-2xl py-1 z-50 max-h-60 overflow-y-auto"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`px-3 py-2 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-ink-secondary hover:bg-paper-hover hover:text-ink"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span>{opt.label}</span>
                    {opt.badge && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 text-ink-muted border border-rule font-mono">
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  {opt.desc && (
                    <div className="text-[10px] text-ink-muted mt-0.5">{opt.desc}</div>
                  )}
                </div>

                {isSelected && (
                  <Check weight="bold" className="w-3.5 h-3.5 text-accent flex-shrink-0 ml-2" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
