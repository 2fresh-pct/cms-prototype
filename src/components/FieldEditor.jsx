import { useLayoutEffect, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { flattenTerms } from "../lib/seed";
import { htmlToText } from "../lib/richtext";
import RichTextEditor from "./RichTextEditor";
import MediaPicker from "./MediaPicker";
import EntryReferenceField from "./EntryReferenceField";
import Toggle from "./Toggle";
import MapField from "./MapField";
import Draft from "./Draft";
import OpeningHoursField from "./OpeningHoursField";
import SpecialDaysField from "./SpecialDaysField";
import AdmissionField from "./AdmissionField";
import { WEEKDAYS, summarizeHours } from "../lib/openingHours";
import { summarizeAdmission } from "../lib/admission";
import { holdsSeveral, mediaIds } from "../lib/media";

const INPUT = "w-full rounded-md border border-gray-300 bg-[#fff] h-9 px-3 text-sm focus:border-violet-400 focus:outline-none";
const INPUT_SM = "rounded-md border border-gray-300 bg-[#fff] h-9 px-3 text-sm focus:border-violet-400 focus:outline-none";
// A text box that is exactly as tall as its text: it grows and shrinks as you
// type and as the width changes. One line high when empty (the same 36px as
// other inputs). `singleLine` keeps a value on one line (Enter does nothing,
// pasted line breaks become spaces) while still wrapping what is shown.
function AutoGrowText({ value, onCommit, singleLine = false }) {
  const ref = useRef(null);

  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    fit();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== width) { width = el.clientWidth; fit(); }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      defaultValue={value ?? ""}
      onInput={(e) => {
        if (singleLine && /[\r\n]/.test(e.target.value)) e.target.value = e.target.value.replace(/\s*[\r\n]+\s*/g, " ");
        fit();
      }}
      onKeyDown={singleLine ? (e) => { if (e.key === "Enter") e.preventDefault(); } : undefined}
      onBlur={(e) => onCommit(e.target.value)}
      className="min-h-9 w-full resize-none overflow-hidden rounded-md border border-gray-300 bg-[#fff] px-3 py-2 text-sm leading-5 focus:border-violet-400 focus:outline-none"
    />
  );
}

const ADD_BUTTON = "flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700";
const ICON_BUTTON = "flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-red-600";

export { WEEKDAYS };

function RepeatingList({ value, onCommit, blank, addLabel, renderItem }) {
  const { t } = useI18n();
  return (
    <Draft value={value ?? []} onCommit={onCommit}>
      {(items, setItems, commit) => (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {renderItem(item, (patch) => setItems(items.map((it, idx) => (idx === i ? patch(it) : it))))}
              </div>
              <button
                type="button"
                onClick={() => { const next = items.filter((_, idx) => idx !== i); setItems(next); commit(next); }}
                className={ICON_BUTTON}
                aria-label={t("Remove")}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => { const next = [...items, blank]; setItems(next); commit(next); }}
            className={ADD_BUTTON}
          >
            <Plus size={13} /> {t(addLabel)}
          </button>
        </div>
      )}
    </Draft>
  );
}

// Lower-case and without accents, so "romansky" finds "románský".
const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// The terms in tree order, each with the names of its parents.
function termsWithPath(terms, path = [], depth = 0) {
  return terms.flatMap((term) => [
    { id: term.id, name: term.name, depth, path },
    ...termsWithPath(term.children, [...path, term.name], depth + 1),
  ]);
}

// Picking terms from a taxonomy: what is picked sits above the list as tags
// (each with a remove button) and a filter box narrows the list.
function TaxonomyField({ field, value, onChange, ctx }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const taxonomy = ctx.taxonomies.find((x) => x.id === field.taxonomyId);
  const selected = value ?? [];
  const single = field.multiple === false;
  if (!taxonomy) return <p className="text-sm text-gray-400">{t("No taxonomy selected for this field.")}</p>;
  const terms = termsWithPath(taxonomy.terms);
  if (terms.length === 0) return <p className="text-sm text-gray-400">{t("This taxonomy has no terms yet.")}</p>;

  const needle = fold(query.trim());
  const filtering = needle !== "";
  const shown = filtering ? terms.filter((term) => fold(term.name).includes(needle)) : terms;
  const picked = selected.map((id) => terms.find((term) => term.id === id)).filter(Boolean);

  return (
    <div className="space-y-2">
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {picked.map((term) => (
            // The look of the workflow status pills (Settings), one size up.
            <span key={term.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#fff] py-1.5 pl-4 pr-2 text-sm font-medium text-gray-800 ring-1 ring-inset ring-gray-300">
              {term.name}
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x !== term.id))}
                className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-800"
                aria-label={`${t("Remove")} ${term.name}`}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("Filter terms…")}
        aria-label={t("Filter terms…")}
        className={INPUT}
      />
      {/* No height limit: the list is as tall as its terms (the filter narrows it). */}
      <div className="space-y-0.5 rounded-md border border-gray-300 bg-[#fff] p-2">
        {shown.length === 0 && <p className="px-1.5 py-1 text-sm text-gray-400">{t("No terms match.")}</p>}
        {shown.map((term) => (
          <label
            key={term.id}
            className="flex items-center gap-2 rounded px-1.5 py-1 text-sm text-gray-700 hover:bg-gray-50"
            style={{ paddingLeft: 6 + (filtering ? 0 : term.depth * 16) }}
          >
            <input
              type={single ? "radio" : "checkbox"}
              name={single ? `${field.name}-${ctx.entryId}` : undefined}
              checked={selected.includes(term.id)}
              onChange={() => {
                if (single) onChange([term.id]);
                else onChange(selected.includes(term.id) ? selected.filter((x) => x !== term.id) : [...selected, term.id]);
              }}
              className="h-3.5 w-3.5 border-gray-300 accent-violet-600"
            />
            <span>
              {filtering && term.path.length > 0 && <span className="text-gray-400">{term.path.join(" › ")} › </span>}
              {term.name}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// `ctx` carries what editors need from the rest of the CMS:
// { taxonomies, media, entries, contentTypes, workflowSteps, entryId, locale, uploadMedia }
export default function FieldEditor({ field, value, onChange, ctx }) {
  const { t } = useI18n();

  switch (field.type) {
    case "ID":
      return <input disabled value={ctx.entryId} className="w-full rounded-md border border-gray-300 bg-gray-50 h-9 px-3 text-sm text-gray-500" />;

    case "Short text":
      return <AutoGrowText value={value} onCommit={onChange} />;

    case "Rich text":
      return <RichTextEditor value={value} onChange={onChange} minHeight={110} media={ctx.media} onUpload={ctx.uploadMedia} locale={ctx.locale} />;

    case "Number":
      return (
        <div className="flex items-center gap-2">
          <input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={field.unit ? "w-32 rounded-md border border-gray-300 bg-[#fff] h-9 px-3 text-sm" : INPUT} />
          {field.unit && <span className="text-sm text-gray-500">{t(field.unit)}</span>}
        </div>
      );

    case "Map":
      return <MapField value={value} onChange={onChange} />;

    case "Boolean":
      return <Toggle checked={Boolean(value)} onChange={onChange} label={value ? t("Yes") : t("No")} ariaLabel={field.label ?? field.name} />;

    case "Select": {
      // Blank and repeated options (half-typed in the type editor) are skipped.
      const options = [...new Set((field.options ?? []).filter((o) => o.trim()))];
      return (
        <select value={value ?? field.defaultValue ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-gray-300 bg-[#fff] h-9 px-3 text-sm">
          {!field.defaultValue && <option value="">{t("None")}</option>}
          {options.map((o) => <option key={o} value={o}>{t(o)}</option>)}
        </select>
      );
    }

    case "Date":
      return <input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-gray-300 bg-[#fff] h-9 px-3 text-sm" />;

    case "Media":
    case "Media list":
      return <MediaPicker media={ctx.media} value={value} onChange={onChange} onUpload={ctx.uploadMedia} multiple={holdsSeveral(field)} />;

    case "Reference":
      return <EntryReferenceField field={field} value={value} onChange={onChange} ctx={ctx} />;

    case "Taxonomy":
      return <TaxonomyField field={field} value={value} onChange={onChange} ctx={ctx} />;

    case "Link":
      return (
        <Draft value={value ?? { url: "", label: "" }} onCommit={onChange}>
          {(link, setLink) => (
            <div className="grid grid-cols-2 gap-2">
              <input placeholder={t("URL")} value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} className={INPUT} />
              <input placeholder={t("Label")} value={link.label} onChange={(e) => setLink({ ...link, label: e.target.value })} className={INPUT} />
            </div>
          )}
        </Draft>
      );

    case "Text list":
      return (
        <RepeatingList value={value} onCommit={onChange} blank="" addLabel="Add item"
          renderItem={(item, set) => <input value={item} onChange={(e) => set(() => e.target.value)} className={INPUT} />} />
      );

    case "Key-value":
      return (
        <RepeatingList value={value} onCommit={onChange} blank={{ key: "", value: "" }} addLabel="Add attribute"
          renderItem={(item, set) => (
            <div className="grid grid-cols-2 gap-2">
              <input placeholder={t("Key")} value={item.key} onChange={(e) => set((it) => ({ ...it, key: e.target.value }))} className={INPUT} />
              <input placeholder={t("Value")} value={item.value} onChange={(e) => set((it) => ({ ...it, value: e.target.value }))} className={INPUT} />
            </div>
          )} />
      );

    case "Date ranges":
      return (
        <RepeatingList value={value} onCommit={onChange} blank={{ from: "", to: "", note: "" }} addLabel="Add period"
          renderItem={(item, set) => (
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={item.from} onChange={(e) => set((it) => ({ ...it, from: e.target.value }))} className={INPUT_SM} />
              <span className="text-gray-400">–</span>
              <input type="date" value={item.to} onChange={(e) => set((it) => ({ ...it, to: e.target.value }))} className={INPUT_SM} />
              <input placeholder={t("Note")} value={item.note} onChange={(e) => set((it) => ({ ...it, note: e.target.value }))} className={`${INPUT_SM} min-w-32 flex-1`} />
            </div>
          )} />
      );

    case "Sections":
      return (
        <RepeatingList value={value} onCommit={onChange} blank={{ heading: "", text: "" }} addLabel="Add section"
          renderItem={(item, set) => (
            <div className="space-y-1.5 rounded-md border border-gray-300 p-2">
              <input placeholder={t("Heading")} value={item.heading} onChange={(e) => set((it) => ({ ...it, heading: e.target.value }))} className={INPUT} />
              <textarea rows={3} placeholder={t("Text")} value={item.text} onChange={(e) => set((it) => ({ ...it, text: e.target.value }))} className={`${INPUT} resize-none`} />
            </div>
          )} />
      );

    case "Address":
      return (
        <Draft value={value ?? {}} onCommit={onChange}>
          {(a, setA) => (
            <div className="grid grid-cols-6 gap-2">
              <input placeholder={t("Street")} value={a.street ?? ""} onChange={(e) => setA({ ...a, street: e.target.value })} className={`${INPUT} col-span-6`} />
              <input placeholder={t("Postal code")} value={a.postalCode ?? ""} onChange={(e) => setA({ ...a, postalCode: e.target.value })} className={`${INPUT} col-span-2`} />
              <input placeholder={t("City")} value={a.city ?? ""} onChange={(e) => setA({ ...a, city: e.target.value })} className={`${INPUT} col-span-4`} />
              <input placeholder={t("Country")} value={a.country ?? ""} onChange={(e) => setA({ ...a, country: e.target.value })} className={`${INPUT} col-span-6`} />
            </div>
          )}
        </Draft>
      );

    case "Coordinates":
      return (
        <Draft value={value ?? {}} onCommit={onChange}>
          {(g, setG) => (
            <div className="grid grid-cols-2 gap-2">
              <input placeholder={t("Latitude")} value={g.lat ?? ""} onChange={(e) => setG({ ...g, lat: e.target.value })} className={INPUT} />
              <input placeholder={t("Longitude")} value={g.lng ?? ""} onChange={(e) => setG({ ...g, lng: e.target.value })} className={INPUT} />
            </div>
          )}
        </Draft>
      );

    case "Opening hours":
      return <OpeningHoursField value={value} onChange={onChange} ctx={ctx} />;

    case "Special days":
      return <SpecialDaysField value={value} onChange={onChange} />;

    case "Admission":
      return <AdmissionField value={value} onChange={onChange} />;

    default:
      return <AutoGrowText value={value} onCommit={onChange} singleLine />;
  }
}

// Plain-text rendering of a field value, used by the read-only version history view.
export function fieldValueText(f, value, ctx, tr) {
  const empty = "—";
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return empty;
  switch (f.type) {
    case "Taxonomy": {
      const taxonomy = ctx.taxonomies.find((x) => x.id === f.taxonomyId);
      if (!taxonomy) return empty;
      const flat = flattenTerms(taxonomy.terms);
      return value.map((id) => flat.find((x) => x.id === id)?.name).filter(Boolean).join(", ") || empty;
    }
    case "Rich text": return htmlToText(value) || empty;
    case "Boolean": return value ? tr("Yes") : tr("No");
    case "Media":
    case "Media list": return mediaIds(value).map((id) => ctx.media.find((m) => m.id === id)?.name).filter(Boolean).join(", ") || empty;
    case "Reference": return value.map((id) => ctx.entries.find((e) => e.id === id)?.title).filter(Boolean).join(", ") || empty;
    case "Select": return tr(value);
    case "Number": return f.unit ? `${value} ${tr(f.unit)}` : String(value);
    case "Link": return value.url ? (value.label ? `${value.label} (${value.url})` : value.url) : empty;
    case "Text list": return value.filter(Boolean).join(" · ") || empty;
    case "Key-value": return value.map((p) => `${p.key}: ${p.value}`).join(" · ");
    case "Date ranges": return value.map((r) => `${r.from}–${r.to}${r.note ? ` (${r.note})` : ""}`).join(" · ");
    case "Sections": return value.map((s) => s.heading).filter(Boolean).join(" · ") || empty;
    case "Address": return [value.street, [value.postalCode, value.city].filter(Boolean).join(" "), value.country].filter(Boolean).join(", ") || empty;
    case "Coordinates": return value.lat || value.lng ? `${value.lat}, ${value.lng}` : empty;
    case "Map": return [value.address, typeof value.lat === "number" ? `${value.lat}, ${value.lng}` : ""].filter(Boolean).join(" · ") || empty;
    case "Opening hours": return summarizeHours(value, tr);
    case "Special days": return value.filter((d) => d.from || d.label).map((d) => `${d.label ? `${d.label} ` : ""}${d.from}${d.to && d.to !== d.from ? `–${d.to}` : ""} ${d.mode === "hours" ? (d.intervals ?? []).map((i) => `${i.open}–${i.close}`).join(", ") : tr("Closed")}`).join(" · ") || empty;
    case "Admission": return summarizeAdmission(value, tr);
    default: return String(value);
  }
}
