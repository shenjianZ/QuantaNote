import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function Select({
  options,
  value,
  onChange,
  className = "",
  placeholder,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleSelect(val: string) {
    onChange(val);
    setOpen(false);
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        className="flex h-9 w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--field)] px-3 text-sm text-[var(--text)] transition-colors hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
        onClick={() => setOpen(!open)}
      >
        <span className={!selected ? "text-[var(--muted)]" : ""}>
          {selected?.label ?? placeholder ?? "请选择"}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--popover)] py-1 shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                opt.value === value
                  ? "bg-[var(--accent-soft)] text-[var(--accent)] font-medium"
                  : "text-[var(--text)] hover:bg-[var(--hover)]"
              }`}
              onClick={() => handleSelect(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
