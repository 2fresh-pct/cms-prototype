// Opening hours, in layers. What a visitor sees on a date is the first that
// applies of:
//   1. a temporary closure (a dated range, with a reason)
//   2. a special day (a date or range: closed, or other hours)
//   3. the regular hours of the period (season) that covers the date
//   4. nothing: unknown (never "open")
//
// A regular-hours value is { seasons: [{ name, from, to, days }] }: `from` and
// `to` are "MM-DD" and repeat every year (both empty: the whole year), and
// `days` has an entry per weekday, { mode, intervals }, where mode is "closed",
// "open" (the intervals are the open times, several when there is a break) or
// "all-day". The older shape, one { open, close } or null per weekday, is read as
// a single whole-year period.

export const WEEKDAYS = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];
const KEYS = WEEKDAYS.map(([k]) => k);
const JS_DAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const DEFAULT_INTERVAL = { open: "09:00", close: "17:00" };

const CLOSED = () => ({ mode: "closed", intervals: [] });

function normalizeDay(d) {
  if (!d) return CLOSED();
  if (d.mode) return { mode: d.mode, intervals: Array.isArray(d.intervals) ? d.intervals : [] };
  if (d.open != null) {
    if (d.open === "00:00" && d.close === "24:00") return { mode: "all-day", intervals: [] };
    return { mode: "open", intervals: [{ open: d.open, close: d.close === "24:00" ? "23:59" : d.close ?? "" }] };
  }
  return CLOSED();
}

const normalizeDays = (days) => Object.fromEntries(KEYS.map((k) => [k, normalizeDay(days?.[k])]));

export function normalizeHours(value) {
  if (Array.isArray(value?.seasons)) {
    return { seasons: value.seasons.map((s) => ({ name: s.name ?? "", from: s.from ?? "", to: s.to ?? "", days: normalizeDays(s.days) })) };
  }
  if (value && KEYS.some((k) => k in value)) {
    return { seasons: [{ name: "", from: "", to: "", days: normalizeDays(value) }] };
  }
  return { seasons: [] };
}

// A new period: Monday to Friday 9-17 and closed at the weekend (to be adjusted),
// for the whole year or for the given "MM-DD" range.
export function newSeason(from = "", to = "") {
  const open = () => ({ mode: "open", intervals: [{ ...DEFAULT_INTERVAL }] });
  const days = Object.fromEntries(KEYS.map((k) => [k, k === "sat" || k === "sun" ? CLOSED() : open()]));
  return { name: "", from, to, days };
}

// Is "MM-DD" inside a period (which may run over the new year)?
function inPeriod(season, md) {
  if (!season.from && !season.to) return true;
  const from = season.from || "01-01";
  const to = season.to || "12-31";
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

const inRange = (date, from, to) => date >= from && date <= (to || from);

// What applies on `date` ("YYYY-MM-DD"). `specials` are special days,
// `closures` temporary closures ({ from, to, note }).
export function hoursForDate(date, { hours, specials = [], closures = [] }) {
  const closure = closures.find((c) => c.from && inRange(date, c.from, c.to));
  if (closure) return { kind: "closure", note: closure.note ?? "", until: closure.to || closure.from };

  const special = specials.find((s) => s.from && inRange(date, s.from, s.to));
  if (special) {
    return special.mode === "hours"
      ? { kind: "special-hours", label: special.label ?? "", intervals: special.intervals ?? [] }
      : { kind: "special-closed", label: special.label ?? "" };
  }

  const { seasons } = normalizeHours(hours);
  const md = date.slice(5);
  const season = seasons.filter((s) => s.from || s.to).find((s) => inPeriod(s, md)) ?? seasons.find((s) => !s.from && !s.to);
  if (!season) return { kind: "unknown" };
  const day = season.days[JS_DAY[new Date(`${date}T12:00:00`).getDay()]];
  return { kind: "regular", season: season.name, mode: day.mode, intervals: day.intervals };
}

// The special days and temporary closures that sit beside the regular hours on
// the same entry, found by type (and, for closures, a "closure" label).
export function layersFromEntry(ctx) {
  const entry = ctx?.entries?.find((e) => e.id === ctx.entryId);
  const type = ctx?.contentTypes?.find((ct) => ct.id === entry?.contentTypeId);
  const specials = [];
  const closures = [];
  for (const f of type?.fields ?? []) {
    const v = entry?.fieldValues?.[f.name];
    if (!Array.isArray(v)) continue;
    if (f.type === "Special days") specials.push(...v);
    else if (f.type === "Date ranges" && /uzav|closure|closed/i.test(`${f.label ?? ""} ${f.name}`)) closures.push(...v);
  }
  return { specials, closures };
}

export const formatIntervals = (intervals) => (intervals ?? []).filter((i) => i.open || i.close).map((i) => `${i.open}–${i.close}`).join(", ");

// "1. 4." from "04-01" and "24. 12. 2026" from "2026-12-24", in the UI's date format.
export const formatMonthDay = (md, locale) => {
  const [m, d] = md.split("-").map(Number);
  return new Date(2024, m - 1, d).toLocaleDateString(locale, { day: "numeric", month: "numeric" });
};
export const formatDate = (date, locale) => (date ? new Date(`${date}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "numeric", year: "numeric" }) : "");

// One line for a day of regular hours: "09:00–17:00", "closed", "open 24 hours".
export function describeDay(day, tr) {
  if (day.mode === "all-day") return tr("Open 24 hours");
  if (day.mode === "open") return formatIntervals(day.intervals) || "—";
  return tr("Closed");
}

// Where the days of a period are the same, "Monday–Friday 09:00–17:00": the
// summary used in the version history.
export function summarizeHours(value, tr) {
  const { seasons } = normalizeHours(value);
  if (seasons.length === 0) return "—";
  return seasons
    .map((s) => {
      const days = WEEKDAYS.map(([k, label]) => `${tr(label).slice(0, 2)} ${describeDay(s.days[k], tr)}`).join(", ");
      return `${s.name ? `${s.name}: ` : ""}${days}`;
    })
    .join(" · ");
}
