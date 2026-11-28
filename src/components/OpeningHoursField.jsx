import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "../lib/i18n";
import Draft from "./Draft";
import TimeIntervals from "./TimeIntervals";
import DatePicker from "./DatePicker";
import { WEEKDAYS, DEFAULT_INTERVAL, normalizeHours, newSeason, weekRange, daysForRange } from "../lib/openingHours";

const FIELD = "h-9 rounded-md border border-gray-300 bg-[#fff] px-3 text-sm focus:border-violet-400 focus:outline-none";
const SECONDARY = "flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50";

// A day and month ("MM-DD") without a year, since a period repeats every year.
function MonthDay({ value, onChange, label }) {
  const { dateLocale } = useI18n();
  const [m, d] = value.split("-").map(Number);
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(dateLocale, { month: "long" }).format(new Date(2024, i, 1))),
    [dateLocale]
  );
  const set = (month, day) => {
    const last = new Date(2024, month, 0).getDate();
    const dd = Math.min(Math.max(1, Number(day) || 1), last);
    onChange(`${String(month).padStart(2, "0")}-${String(dd).padStart(2, "0")}`);
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <input type="number" min={1} max={31} value={d} onChange={(e) => set(m, e.target.value)} aria-label={`${label}: day`} className={`${FIELD} w-16`} />
      <select value={m} onChange={(e) => set(Number(e.target.value), d)} aria-label={`${label}: month`} className={FIELD}>
        {months.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
      </select>
    </span>
  );
}

const todayLocal = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

// One period (season) of regular hours. The days are one range with one set of times
// ("Monday to Sunday 8-16") when they are that simple; "set each day separately"
// shows every day. A period whose days do not fit one range always shows every day.
function Period({ s, i, patch, remove }) {
  const { t } = useI18n();
  const [eachDay, setEachDay] = useState(false);
  const isDate = s.date != null;
  const dated = !isDate && Boolean(s.from || s.to);
  const kind = isDate ? "date" : dated ? "period" : "year";
  const range = isDate ? null : weekRange(s.days);
  const perDay = !isDate && (eachDay || !range);
  const setDays = (days, now) => patch(i, { days }, now);
  const setDay = (key, day, now) => setDays({ ...s.days, [key]: day }, now);
  const changeKind = (next) => {
    if (next === "date") patch(i, { date: todayLocal(), from: "", to: "", intervals: [{ open: "19:00", close: "" }] }, true);
    else patch(i, { date: null, intervals: [], ...(next === "period" ? { from: "04-01", to: "10-31" } : { from: "", to: "" }) }, true);
  };
  const useMonday = () => {
    const copy = () => ({ ...s.days.mon, intervals: s.days.mon.intervals.map((iv) => ({ ...iv })) });
    setDays({ ...s.days, tue: copy(), wed: copy(), thu: copy(), fri: copy(), sat: copy(), sun: copy() }, true);
  };
  const setRange = (from, to) => setDays(daysForRange(from, to, range.intervals), true);

  return (
    <div className="space-y-4 rounded-md border border-gray-300 bg-[#fff] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={s.name}
          onChange={(e) => patch(i, { name: e.target.value }, false)}
          placeholder={t("Period name (optional)")}
          aria-label={t("Period name (optional)")}
          className={`${FIELD} w-56`}
        />
        <select value={kind} onChange={(e) => changeKind(e.target.value)} aria-label={t("Applies")} className={FIELD}>
          <option value="year">{t("Whole year")}</option>
          <option value="period">{t("Only in a period")}</option>
          <option value="date">{t("Specific date")}</option>
        </select>
        {!isDate && !perDay && (
          <button type="button" onClick={() => setEachDay(true)} className={SECONDARY}>{t("Set each day separately")}</button>
        )}
        {perDay && (
          <>
            <button type="button" onClick={useMonday} className={SECONDARY}>{t("Use Monday for every day")}</button>
            {range && <button type="button" onClick={() => setEachDay(false)} className={SECONDARY}>{t("Simplify")}</button>}
          </>
        )}
        {isDate && (
          <span className="flex flex-wrap items-center gap-2">
            <DatePicker value={s.date} onChange={(date) => patch(i, { date: date || s.date }, true)} ariaLabel={t("Date")} className={`${FIELD} w-44`} />
            <TimeIntervals intervals={s.intervals} onChange={(intervals, now) => patch(i, { intervals }, now)} optionalEnd />
          </span>
        )}
        {dated && (
          <span className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            {t("From")}
            <MonthDay value={s.from || "01-01"} onChange={(from) => patch(i, { from }, false)} label={t("From")} />
            {t("to")}
            <MonthDay value={s.to || "12-31"} onChange={(to) => patch(i, { to }, false)} label={t("to")} />
          </span>
        )}
        <button
          type="button"
          onClick={remove}
          aria-label={t("Remove period")}
          title={t("Remove period")}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-red-600"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {!isDate && !perDay && (
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex items-center gap-2">
            <select
              value={range.from}
              onChange={(e) => { const from = Number(e.target.value); setRange(from, Math.max(from, range.to)); }}
              aria-label={t("From day")}
              className={FIELD}
            >
              {WEEKDAYS.map(([key, label], idx) => <option key={key} value={idx}>{t(label)}</option>)}
            </select>
            <span className="text-gray-500">–</span>
            <select
              value={range.to}
              onChange={(e) => { const to = Number(e.target.value); setRange(Math.min(range.from, to), to); }}
              aria-label={t("To day")}
              className={FIELD}
            >
              {WEEKDAYS.map(([key, label], idx) => <option key={key} value={idx}>{t(label)}</option>)}
            </select>
          </span>
          <TimeIntervals intervals={range.intervals} onChange={(intervals, now) => setDays(daysForRange(range.from, range.to, intervals), now)} />
        </div>
      )}

      {perDay && (
        <div className="space-y-3">
          {WEEKDAYS.map(([key, label]) => {
            const day = s.days[key];
            return (
              <div key={key} className="flex items-start gap-3">
                <span className="w-24 shrink-0 pt-2 text-sm text-gray-900">{t(label)}</span>
                <select
                  value={day.mode}
                  onChange={(e) => {
                    const mode = e.target.value;
                    setDay(key, { mode, intervals: mode === "open" ? (day.intervals.length ? day.intervals : [{ ...DEFAULT_INTERVAL }]) : [] }, true);
                  }}
                  aria-label={t(label)}
                  className={`${FIELD} w-36 shrink-0`}
                >
                  <option value="closed">{t("Closed")}</option>
                  <option value="open">{t("Open for visitors")}</option>
                  <option value="all-day">{t("Open 24 hours")}</option>
                </select>
                {day.mode === "open" && (
                  <TimeIntervals intervals={day.intervals} onChange={(intervals, now) => setDay(key, { mode: "open", intervals }, now)} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Regular opening hours: one or several periods (seasons), each with its hours for
// the week. A period covers the whole year or a range of dates that repeats every
// year; where periods overlap, the one with dates wins over the whole-year one.
export default function OpeningHoursField({ value, onChange }) {
  const { t } = useI18n();
  return (
    <Draft value={normalizeHours(value)} onCommit={onChange}>
      {(hours, setHours, commit) => {
        const seasons = hours.seasons;
        const save = (next, now) => {
          const v = { seasons: next };
          setHours(v);
          if (now) commit(v);
        };
        const patch = (i, p, now) => save(seasons.map((s, k) => (k === i ? { ...s, ...p } : s)), now);

        if (seasons.length === 0) {
          return (
            <div className="flex items-center gap-4 rounded-md border border-dashed border-gray-300 px-3 py-3">
              <button type="button" onClick={() => save([newSeason()], true)} className={SECONDARY}>
                <Plus size={14} /> {t("Add opening hours")}
              </button>
              <span className="text-sm text-gray-500">{t("No opening hours yet. Without them the app shows no open or closed status.")}</span>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {seasons.map((s, i) => (
              <Period key={i} s={s} i={i} patch={patch} remove={() => save(seasons.filter((_, k) => k !== i), true)} />
            ))}
            <button type="button" onClick={() => save([...seasons, newSeason("04-01", "10-31")], true)} className={SECONDARY}>
              <Plus size={14} /> {t("Add time period")}
            </button>
          </div>
        );
      }}
    </Draft>
  );
}
