import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

// A text box with a list of suggestions that opens below it. Any text can be typed;
// `onChange(text, picked)`: `picked` is true when a suggestion was chosen. The list always shows every suggestion (a native datalist only shows those that
// match what is already typed, so after choosing one it offered just that one).
export default function ComboInput({ value, onChange, options, className = "", ariaLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        aria-expanded={open}
        role="combobox"
        autoComplete="off"
        className={`${className} pr-8`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-gray-500"
      >
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-md border border-gray-300 bg-white py-1 shadow-lg">
          {options.map((o) => (
            <li key={o} role="option" aria-selected={o === value}>
              <button
                type="button"
                onClick={() => { onChange(o, true); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                <span className="flex-1 truncate">{o}</span>
                {o === value && <Check size={14} className="shrink-0 text-gray-500" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
