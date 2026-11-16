import { Fragment } from "react";
import { useI18n } from "../lib/i18n";
import { WEEKDAYS, normalizeHours, describeDay, formatIntervals, formatMonthDay, formatDate } from "../lib/openingHours";
import { normalizeAdmission } from "../lib/admission";

// Read-only renderings of the opening hours, special days and admission fields,
// for published items, the version history and the website / app preview.

export function OpeningHoursView({ value, text = "text-sm" }) {
  const { t, dateLocale } = useI18n();
  const { seasons } = normalizeHours(value);
  if (seasons.length === 0) return <p className={`${text} text-gray-500`}>—</p>;
  return (
    <div className="space-y-4">
      {seasons.map((s, i) => {
        const period = s.from || s.to
          ? `${formatMonthDay(s.from || "01-01", dateLocale)} – ${formatMonthDay(s.to || "12-31", dateLocale)}`
          : t("Whole year");
        return (
          <section key={i}>
            <h4 className="mb-1.5 text-sm font-semibold text-gray-900">{[s.name, period].filter(Boolean).join(" · ")}</h4>
            <dl className={`grid grid-cols-[7rem_1fr] gap-y-1 ${text} text-gray-700`}>
              {WEEKDAYS.map(([key, label]) => (
                <Fragment key={key}>
                  <dt className="text-gray-500">{t(label)}</dt>
                  <dd>{describeDay(s.days[key], t)}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}

export function SpecialDaysView({ value, text = "text-sm" }) {
  const { t, dateLocale } = useI18n();
  const days = (Array.isArray(value) ? value : []).filter((d) => d.from || d.label);
  if (days.length === 0) return <p className={`${text} text-gray-500`}>—</p>;
  return (
    <ul className={`space-y-1.5 ${text} text-gray-700`}>
      {days.map((d, i) => {
        const when = d.to && d.to !== d.from ? `${formatDate(d.from, dateLocale)} – ${formatDate(d.to, dateLocale)}` : formatDate(d.from, dateLocale);
        return (
          <li key={i}>
            {d.label && <span className="font-medium text-gray-900">{d.label} · </span>}
            {when}: {d.mode === "hours" ? formatIntervals(d.intervals) || "—" : t("Closed")}
          </li>
        );
      })}
    </ul>
  );
}

export function AdmissionView({ value, text = "text-sm" }) {
  const { t, dateLocale } = useI18n();
  const a = normalizeAdmission(value);
  if (a.type === "unknown") return <p className={`${text} text-gray-500`}>—</p>;
  return (
    <div className={`space-y-1.5 ${text} text-gray-700`}>
      {a.type === "free" && <p className="font-medium text-gray-900">{t("Free")}</p>}
      {a.type === "paid" && (
        <ul className="space-y-1">
          {a.prices.filter((p) => p.price !== "" || p.ticket).map((p, i) => (
            <li key={i}>
              <span className="font-medium text-gray-900">{p.ticket ? `${t(p.ticket)}: ` : ""}{p.price !== "" ? `${p.price} ${t("CZK")}` : ""}</span>
              {(p.from || p.to) && (
                <span className="text-gray-500"> · {p.from ? formatDate(p.from, dateLocale) : ""} – {p.to ? formatDate(p.to, dateLocale) : ""}</span>
              )}
              {p.note && <span className="text-gray-500"> · {p.note}</span>}
            </li>
          ))}
        </ul>
      )}
      {a.type === "link" && <p><span className="font-medium text-gray-900">{a.seller || t("Tickets")}</span>{a.url && <> · <span className="underline">{a.url}</span></>}</p>}
      {a.type === "free" && a.url && <p className="underline">{a.url}</p>}
      {a.note && <p>{a.note}</p>}
    </div>
  );
}
