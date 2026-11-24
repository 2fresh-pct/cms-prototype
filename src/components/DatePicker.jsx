import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useI18n } from "../lib/i18n";

// A date field with its own calendar (the browser's native one can't be translated or
// styled). Value: "YYYY-MM-DD" or "". Weeks start on Monday; month and weekday names
// and the format of the shown date follow the interface language.
const pad = (n) => String(n).padStart(2, "0");
const toIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
};

export default function DatePicker({ value, onChange, className = "", ariaLabel, title }) {
  const { t, dateLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const current = parse(value);
  const today = new Date();
  // The month on show: that of the value, else this month.
  const [view, setView] = useState(() => ({ y: current?.y ?? today.getFullYear(), m: current?.m ?? today.getMonth() }));

  // Opening shows the month of the value; the popover goes below the field, or above it
  // when there is no room.
  useLayoutEffect(() => {
    if (!open) return;
    const r = triggerRef.current.getBoundingClientRect();
    const h = popRef.current?.offsetHeight ?? 340;
    const w = popRef.current?.offsetWidth ?? 288;
    const below = r.bottom + 6 + h <= window.innerHeight || r.top - 6 - h < 0;
    setPos({
      top: below ? r.bottom + 6 : r.top - 6 - h,
      left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
    });
  }, [open, view]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!popRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } };
    const onScroll = (e) => { if (!popRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", () => setOpen(false), { once: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const monthName = new Intl.DateTimeFormat(dateLocale, { month: "long", year: "numeric" }).format(new Date(view.y, view.m, 1));
  // Monday 2024-01-01 .. Sunday 2024-01-07
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(dateLocale, { weekday: "short" }).format(new Date(2024, 0, 1 + i)));
  const first = new Date(view.y, view.m, 1);
  const lead = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => new Date(view.y, view.m, 1 - lead + i));
  const shown = current ? new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "numeric", year: "numeric" }).format(new Date(current.y, current.m, current.d)) : "";

  const go = (months) => setView(({ y, m }) => {
    const d = new Date(y, m + months, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const pick = (iso) => { onChange(iso); setOpen(false); triggerRef.current?.focus(); };
  const nav = "flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900";
  const isoToday = toIso(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        title={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) setView({ y: current?.y ?? today.getFullYear(), m: current?.m ?? today.getMonth() });
          setOpen((o) => !o);
        }}
        className={`flex items-center justify-between gap-2 rounded-md border border-gray-300 bg-[#fff] text-left text-sm ${className}`}
      >
        <span className={shown ? "text-gray-900" : "text-gray-400"}>{shown || t("Select a date")}</span>
        <CalendarDays size={14} className="shrink-0 text-gray-400" />
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label={ariaLabel ?? t("Select a date")}
          style={{ top: pos.top, left: pos.left }}
          className="wf-pop fixed z-[60] w-72 rounded-lg border border-gray-300 bg-white p-3 text-sm"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex">
              <button type="button" onClick={() => go(-12)} aria-label={t("Previous year")} className={nav}><ChevronsLeft size={15} /></button>
              <button type="button" onClick={() => go(-1)} aria-label={t("Previous month")} className={nav}><ChevronLeft size={15} /></button>
            </div>
            <span className="font-semibold capitalize text-gray-900">{monthName}</span>
            <div className="flex">
              <button type="button" onClick={() => go(1)} aria-label={t("Next month")} className={nav}><ChevronRight size={15} /></button>
              <button type="button" onClick={() => go(12)} aria-label={t("Next year")} className={nav}><ChevronsRight size={15} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-medium uppercase text-gray-500">
            {weekdays.map((w) => <span key={w} className="py-1">{w.replace(".", "").slice(0, 2)}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5 text-center">
            {cells.map((d) => {
              const iso = toIso(d.getFullYear(), d.getMonth(), d.getDate());
              const inMonth = d.getMonth() === view.m;
              const selected = iso === value;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pick(iso)}
                  aria-pressed={selected}
                  className={`mx-auto flex h-8 w-8 items-center justify-center rounded-md ${
                    selected ? "bg-violet-600 font-semibold text-white"
                      : `${inMonth ? "text-gray-900" : "text-gray-400"} hover:bg-gray-100 ${iso === isoToday ? "ring-1 ring-inset ring-gray-500" : ""}`
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2">
            <button type="button" onClick={() => pick("")} className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">{t("Clear")}</button>
            <button type="button" onClick={() => pick(isoToday)} className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">{t("Today")}</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
