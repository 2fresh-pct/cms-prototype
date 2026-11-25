import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { DEFAULT_INTERVAL } from "../lib/openingHours";

const TIME = "h-9 rounded-md border border-gray-300 bg-[#fff] px-2.5 text-sm focus:border-violet-400 focus:outline-none";

// The open times of one day: one or several "from – to" ranges (several when the
// place closes for a break). `onChange(intervals, structural)`: `structural` is
// true for adding and removing a range, which is saved straight away. The add
// button sits at the end of the last range, so a day with one range is one line.
//
// With `optionalEnd` (a specific date, an event) the end can stay empty and a new
// time starts with no end.
export default function TimeIntervals({ intervals, onChange, optionalEnd = false }) {
  const { t } = useI18n();
  const list = intervals.length > 0 ? intervals : [optionalEnd ? { open: "19:00", close: "" } : { ...DEFAULT_INTERVAL }];
  const edit = (i, patch) => onChange(list.map((iv, k) => (k === i ? { ...iv, ...patch } : iv)), false);
  return (
    <div className="space-y-1.5">
      {list.map((iv, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <input type="time" value={iv.open} onChange={(e) => edit(i, { open: e.target.value })} aria-label={t(optionalEnd ? "Starts" : "Opens")} className={TIME} />
          <span className="text-gray-500">–</span>
          <input type="time" value={iv.close} onChange={(e) => edit(i, { close: e.target.value })} aria-label={t(optionalEnd ? "Ends (optional)" : "Closes")} className={TIME} />
          {list.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(list.filter((_, k) => k !== i), true)}
              aria-label={t("Remove interval")}
              title={t("Remove interval")}
              className="flex h-8 w-8 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-red-600"
            >
              <Trash2 size={14} />
            </button>
          )}
          {i === list.length - 1 && (
            <button
              type="button"
              onClick={() => onChange([...list, optionalEnd ? { open: "21:00", close: "" } : { open: "13:00", close: "17:00" }], true)}
              className="ml-2 flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700"
            >
              <Plus size={13} /> {t(optionalEnd ? "Add time" : "Add interval")}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
