import { Copy, Plus, Trash2 } from "lucide-react";
import { useI18n } from "../lib/i18n";
import Draft from "./Draft";
import TimeIntervals from "./TimeIntervals";
import { DEFAULT_INTERVAL } from "../lib/openingHours";

const FIELD = "h-9 rounded-md border border-gray-300 bg-[#fff] px-3 text-sm focus:border-violet-400 focus:outline-none";
const ADD = "flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700";

const blank = () => ({ label: "", from: "", to: "", mode: "closed", intervals: [] });
const normalize = (d) => ({ ...blank(), ...d, intervals: Array.isArray(d?.intervals) ? d.intervals : [] });

// The same date a year later ("2026-12-24" -> "2027-12-24"; 29 February -> 28 February).
function nextYear(date) {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(y + 1, m, 0).getDate();
  return `${y + 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

// Special days: dates (or a range of dates) when the opening hours differ from the
// regular ones, such as Christmas Eve or a holiday, closed or with other hours.
// Each has its own dates, so it applies by itself when the day comes and can be
// entered long before it. They override the regular hours.
export default function SpecialDaysField({ value, onChange }) {
  const { t } = useI18n();
  const list = Array.isArray(value) ? value.map(normalize) : [];
  return (
    <Draft value={list} onCommit={onChange}>
      {(days, setDays, commit) => {
        const save = (next, now) => {
          setDays(next);
          if (now) commit(next);
        };
        const patch = (i, p, now) => save(days.map((d, k) => (k === i ? { ...d, ...p } : d)), now);

        const addButton = (
          <button
            type="button"
            onClick={() => save([...days, blank()], true)}
            className={days.length === 0 ? "flex items-center gap-1.5 rounded-md border border-gray-300 bg-white h-9 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50" : ADD}
          >
            <Plus size={days.length === 0 ? 14 : 13} /> {t("Add special day")}
          </button>
        );

        if (days.length === 0) {
          return (
            <div className="flex items-center gap-4 rounded-md border border-dashed border-gray-300 px-3 py-3">
              {addButton}
              <span className="text-sm text-gray-500">{t("Holidays and other days with different hours. They replace the regular hours on that day.")}</span>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {days.map((d, i) => (
              <div key={i} className="space-y-3 rounded-md border border-gray-300 bg-[#fff] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={d.label}
                    onChange={(e) => patch(i, { label: e.target.value }, false)}
                    placeholder={t("Name, for example Christmas Eve")}
                    aria-label={t("Name")}
                    className={`${FIELD} w-60`}
                  />
                  <input type="date" value={d.from} onChange={(e) => patch(i, { from: e.target.value }, false)} aria-label={t("Date")} className={FIELD} />
                  <span className="text-gray-500">–</span>
                  <input type="date" value={d.to} onChange={(e) => patch(i, { to: e.target.value }, false)} aria-label={t("Until (optional)")} title={t("Until (optional)")} className={FIELD} />
                  <select
                    value={d.mode}
                    onChange={(e) => {
                      const mode = e.target.value;
                      patch(i, { mode, intervals: mode === "hours" ? (d.intervals.length ? d.intervals : [{ ...DEFAULT_INTERVAL }]) : [] }, true);
                    }}
                    aria-label={t("On this day")}
                    className={FIELD}
                  >
                    <option value="closed">{t("Closed")}</option>
                    <option value="hours">{t("Different hours")}</option>
                  </select>
                  <span className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => save([...days.slice(0, i + 1), { ...d, intervals: d.intervals.map((iv) => ({ ...iv })), from: nextYear(d.from), to: nextYear(d.to) }, ...days.slice(i + 1)], true)}
                      title={t("Copy a year ahead")}
                      className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      <Copy size={13} /> {t("Copy a year ahead")}
                    </button>
                    <button
                      type="button"
                      onClick={() => save(days.filter((_, k) => k !== i), true)}
                      aria-label={t("Remove special day")}
                      title={t("Remove special day")}
                      className="flex h-8 w-8 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
                {d.mode === "hours" && (
                  <TimeIntervals intervals={d.intervals} onChange={(intervals, now) => patch(i, { intervals }, now)} />
                )}
              </div>
            ))}
            {addButton}
          </div>
        );
      }}
    </Draft>
  );
}
