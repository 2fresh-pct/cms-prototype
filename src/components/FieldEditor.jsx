import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { flattenTerms } from "../lib/seed";
import { htmlToText } from "../lib/richtext";
import RichTextEditor from "./RichTextEditor";
import MediaPicker from "./MediaPicker";
import EntryReferenceField from "./EntryReferenceField";
import { holdsSeveral, mediaIds } from "../lib/media";

const INPUT = "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none";
const INPUT_SM = "rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none";
const ADD_BUTTON = "flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700";
const ICON_BUTTON = "rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600";

export const WEEKDAYS = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

// Structured values are edited as a local draft and written back when focus
// leaves the editor (or immediately for add/remove), so typing doesn't create
// a history entry per keystroke.
function Draft({ value, onCommit, children }) {
  const [draft, setDraft] = useState(value);
  const commit = (next) => {
    if (JSON.stringify(next) !== JSON.stringify(value)) onCommit(next);
  };
  return (
    <div onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) commit(draft); }}>
      {children(draft, setDraft, commit)}
    </div>
  );
}

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

function TaxonomyField({ field, value, onChange, ctx }) {
  const { t } = useI18n();
  const taxonomy = ctx.taxonomies.find((x) => x.id === field.taxonomyId);
  const selected = value ?? [];
  const single = field.multiple === false;
  if (!taxonomy) return <p className="text-sm text-gray-400">{t("No taxonomy selected for this field.")}</p>;
  const terms = flattenTerms(taxonomy.terms);
  if (terms.length === 0) return <p className="text-sm text-gray-400">{t("This taxonomy has no terms yet.")}</p>;
  return (
    <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-gray-300 bg-white p-2">
      {terms.map((term) => (
        <label
          key={term.id}
          className="flex items-center gap-2 rounded px-1.5 py-1 text-sm text-gray-700 hover:bg-gray-50"
          style={{ paddingLeft: 6 + term.depth * 16 }}
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
          {term.name}
        </label>
      ))}
    </div>
  );
}

function OpeningHours({ value, onChange }) {
  const { t } = useI18n();
  return (
    <Draft value={value ?? {}} onCommit={onChange}>
      {(hours, setHours, commit) => (
        <div className="space-y-1.5">
          {WEEKDAYS.map(([key, label]) => {
            const day = hours[key];
            const setDay = (next, immediate) => {
              const nextHours = { ...hours, [key]: next };
              setHours(nextHours);
              if (immediate) commit(nextHours);
            };
            return (
              <div key={key} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-gray-700">{t(label)}</span>
                <label className="flex items-center gap-1.5 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={!day}
                    onChange={(e) => setDay(e.target.checked ? null : { open: "09:00", close: "17:00" }, true)}
                    className="h-3.5 w-3.5 rounded border-gray-300 accent-violet-600"
                  />
                  {t("Closed")}
                </label>
                {day && (
                  <span className="flex items-center gap-1.5">
                    <input type="time" value={day.open} onChange={(e) => setDay({ ...day, open: e.target.value })} className={INPUT_SM} />
                    <span className="text-gray-400">–</span>
                    <input type="time" value={day.close === "24:00" ? "23:59" : day.close} onChange={(e) => setDay({ ...day, close: e.target.value })} className={INPUT_SM} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Draft>
  );
}

// `ctx` carries what editors need from the rest of the CMS:
// { taxonomies, media, entries, contentTypes, workflowSteps, entryId, uploadMedia }
export default function FieldEditor({ field, value, onChange, ctx }) {
  const { t } = useI18n();

  switch (field.type) {
    case "ID":
      return <input disabled value={ctx.entryId} className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500" />;

    case "Short text":
      return <textarea rows={2} defaultValue={value ?? ""} onBlur={(e) => onChange(e.target.value)} className={`${INPUT} resize-none`} />;

    case "Rich text":
      return <RichTextEditor value={value} onChange={onChange} minHeight={110} />;

    case "Number":
      return (
        <div className="flex items-center gap-2">
          <input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={field.unit ? "w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" : INPUT} />
          {field.unit && <span className="text-sm text-gray-500">{t(field.unit)}</span>}
        </div>
      );

    case "Boolean":
      return (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={value ?? false} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-violet-600" />
          {value ? t("Yes") : t("No")}
        </label>
      );

    case "Select": {
      const options = field.options ?? [];
      return (
        <select value={value ?? field.defaultValue ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm">
          {!field.defaultValue && <option value="">{t("None")}</option>}
          {options.map((o) => <option key={o} value={o}>{t(o)}</option>)}
        </select>
      );
    }

    case "Date":
      return <input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />;

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
      return <OpeningHours value={value} onChange={onChange} />;

    default:
      return <input defaultValue={value ?? ""} onBlur={(e) => onChange(e.target.value)} className={INPUT} />;
  }
}

function summarizeHours(hours, tr) {
  const open = WEEKDAYS.filter(([k]) => hours?.[k]);
  if (open.length === 0) return "—";
  const first = hours[open[0][0]];
  const same = open.every(([k]) => hours[k].open === first.open && hours[k].close === first.close);
  const days = open.length === 7 ? tr("Every day") : open.map(([, l]) => tr(l).slice(0, 3)).join(", ");
  return same ? `${days} ${first.open}–${first.close}` : `${days} (${tr("varies")})`;
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
    case "Opening hours": return summarizeHours(value, tr);
    default: return String(value);
  }
}
