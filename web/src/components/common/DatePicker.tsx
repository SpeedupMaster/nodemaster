import React, { useState, useRef, useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CaretDoubleLeft,
  CaretDoubleRight,
  X,
} from "@phosphor-icons/react";

gsap.registerPlugin(useGSAP);

export interface DatePickerProps {
  value?: string; // "YYYY-MM-DD"
  onChange: (dateStr: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export const DatePicker: React.FC<DatePickerProps> = ({
  value = "",
  onChange,
  placeholder = "选择到期日期...",
  disabled = false,
  className = "",
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const parseDate = (str: string) => {
    if (!str) return null;
    const parts = str.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d);
      }
    }
    return null;
  };

  const selectedDate = parseDate(value);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [viewYear, setViewYear] = useState(() =>
    selectedDate ? selectedDate.getFullYear() : today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(() =>
    selectedDate ? selectedDate.getMonth() : today.getMonth()
  );

  // Sync viewing month/year when popover opens or value changes
  useEffect(() => {
    if (isOpen) {
      const d = parseDate(value) || new Date();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [isOpen, value]);

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

  // GSAP animation
  useGSAP(() => {
    if (isOpen && popoverRef.current) {
      gsap.fromTo(
        popoverRef.current,
        { opacity: 0, y: -4, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.16, ease: "power2.out" }
      );
    }
  }, { dependencies: [isOpen] });

  const handlePrevYear = () => setViewYear((y) => y - 1);
  const handleNextYear = () => setViewYear((y) => y + 1);

  const handlePrevMonth = () => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };

  const handleNextMonth = () => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };

  // Calendar cells generation
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const firstDayWeekday = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const calendarDays: Array<{
    day: number;
    month: number;
    year: number;
    dateStr: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
  }> = [];

  // Previous month trailing days
  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calendarDays.push({
      day: d,
      month: m,
      year: y,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isSelected: dateStr === value,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calendarDays.push({
      day: d,
      month: viewMonth,
      year: viewYear,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isSelected: dateStr === value,
    });
  }

  // Next month leading days (fill up to 42 cells for stable grid height)
  const remainingCells = 42 - calendarDays.length;
  for (let d = 1; d <= remainingCells; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calendarDays.push({
      day: d,
      month: m,
      year: y,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isSelected: dateStr === value,
    });
  }

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    onChange(todayStr);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} id={id}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full h-[34px] flex items-center justify-between px-3 py-2 rounded-md bg-paper border transition-all text-xs select-none cursor-pointer focus:outline-none ${
          isOpen
            ? "border-accent ring-1 ring-accent/30 bg-paper-hover"
            : "border-rule hover:border-rule-active hover:bg-paper-hover"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <CalendarBlank
            className={`w-3.5 h-3.5 shrink-0 transition-colors ${
              value ? "text-accent" : "text-ink-muted"
            }`}
          />
          <span
            className={`truncate text-xs ${
              value ? "text-ink font-semibold" : "text-ink-muted font-normal"
            }`}
          >
            {value || placeholder}
          </span>
        </div>

        {value ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="p-0.5 rounded hover:bg-paper-3 text-ink-muted hover:text-status-danger transition-colors cursor-pointer shrink-0 ml-1"
            title="清除日期"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        ) : (
          <span className="text-[10px] text-ink-muted opacity-60 shrink-0 ml-1">
            选择
          </span>
        )}
      </button>

      {/* Custom Dropdown Calendar Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full mt-1.5 w-[280px] bg-paper-2 border border-rule rounded-xl shadow-2xl p-3 z-50 select-none animate-in fade-in"
        >
          {/* Header Controls */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-rule">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={handlePrevYear}
                className="p-1 rounded text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors cursor-pointer"
                title="上一年"
              >
                <CaretDoubleLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors cursor-pointer"
                title="上个月"
              >
                <CaretLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-xs font-semibold text-ink tracking-wide">
              {viewYear}年 {viewMonth + 1}月
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors cursor-pointer"
                title="下个月"
              >
                <CaretRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextYear}
                className="p-1 rounded text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors cursor-pointer"
                title="下一年"
              >
                <CaretDoubleRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAYS.map((w, idx) => (
              <span
                key={w}
                className={`text-[11px] py-0.5 ${
                  idx >= 5 ? "text-amber-400/80 font-medium" : "text-ink-muted"
                }`}
              >
                {w}
              </span>
            ))}
          </div>

          {/* Days Grid (6 rows x 7 cols) */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((c) => {
              return (
                <button
                  key={c.dateStr}
                  type="button"
                  onClick={() => handleSelectDate(c.dateStr)}
                  className={`h-7 rounded-lg text-xs transition-all flex items-center justify-center cursor-pointer ${
                    c.isSelected
                      ? "bg-accent text-white font-bold shadow-xs ring-1 ring-accent"
                      : c.isToday
                      ? "ring-1 ring-accent/60 text-accent font-semibold hover:bg-accent/15"
                      : c.isCurrentMonth
                      ? "text-ink hover:bg-paper-hover hover:text-white"
                      : "text-ink-muted/30 hover:text-ink-muted hover:bg-paper-hover/40"
                  }`}
                >
                  {c.day}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-rule text-xs">
            <button
              type="button"
              onClick={handleClear}
              className="px-2 py-1 rounded text-ink-muted hover:text-status-danger hover:bg-paper-3 transition-colors cursor-pointer text-[11px]"
            >
              清除
            </button>
            <button
              type="button"
              onClick={handleSelectToday}
              className="px-2.5 py-1 rounded bg-paper-3 text-accent hover:bg-accent/10 border border-rule transition-colors cursor-pointer text-[11px] font-medium"
            >
              今天
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
