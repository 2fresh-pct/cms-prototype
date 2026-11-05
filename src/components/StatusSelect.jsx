import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useI18n } from "../lib/i18n";

// One control that shows an entry's workflow step (colour dot + name), looks
// like a dropdown and opens a list of the steps it can move to. `steps` are
// { id, name, color }; `value` is the current step's id.
export default function StatusSelect({ value, steps, onChange, fallbackLabel }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = steps.find((s) => s.id === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(id) {
    setOpen(false);
    if (id !== value) onChange(id);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-left text-sm text-gray-800 hover:bg-gray-50"
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: current?.color }} />
        <span className="flex-1 truncate">{t(current?.name ?? fallbackLabel ?? "")}</span>
        <ChevronDown size={14} className={`shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 rounded-md border border-gray-300 bg-white py-1 shadow-lg">
          {steps.map((s) => (
            <li key={s.id} role="option" aria-selected={s.id === value}>
              <button
                type="button"
                onClick={() => choose(s.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="flex-1 truncate">{t(s.name)}</span>
                {s.id === value && <Check size={14} className="shrink-0 text-gray-500" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
