// Fields that are not localized hold one value for every language version of an
// item: what is picked in Czech is also what German and English have. Each language
// version is its own entry (own status, history, comments), so the value is kept in
// step by copying: when it changes in one version it is written to the others that
// can still be edited, a new language version starts with it, and a published
// version picks it up when it gets a new draft. A published version is never
// changed behind its back.
//
// A field counts as shared when it is not marked localized. "Partly localized"
// fields are not shared, since part of them is translated. The title, slug and
// body, which are always per language, and layout and read-only fields hold no
// value to share.
//
// Opening hours, special days, admission and date ranges (closures) are always
// shared, with one difference: the names and notes inside them are translated. What
// is shared is their structure (the periods, days, prices and dates, with the times
// and amounts); every language version keeps its own names and notes. The parts of a
// list are matched across versions by their `id`.

// The element types that share their structure and translate their names and notes.
const WITH_TEXTS = new Set(["Opening hours", "Special days", "Admission", "Date ranges"]);
export const hasLocalizedTexts = (type) => WITH_TEXTS.has(type);

// What the item page shows as the element's localization: such an element is shared,
// but "partly" translated.
export const localizationOf = (f) => (hasLocalizedTexts(f.type) ? "partly" : f.localized);

export const isSharedField = (f) =>
  (hasLocalizedTexts(f.type) || !f.localized) && !f.core && f.type !== "Separator" && f.type !== "ID" && !["title", "slug", "body"].includes(f.name);

// A new id for a part of a list (a period, a special day, a price).
export const newItemId = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// The parts of `source` with the names and notes of the matching parts of `own`. A
// part that `own` does not have yet starts with the text it has in `source`.
function mergeItems(source, own, keys) {
  const mine = Array.isArray(own) ? own : [];
  return (Array.isArray(source) ? source : []).map((item, i) => {
    const match = item.id ? mine.find((o) => o.id === item.id) : mine[i];
    if (!match) return item;
    return { ...item, ...Object.fromEntries(keys.map((k) => [k, match[k] ?? ""])) };
  });
}

// `source` is the structure to take over; `own` is what this language version holds
// now, which has the texts to keep. A version with nothing yet takes `source` as it is.
export function mergeLocalizedTexts(type, source, own) {
  if (source == null) return source;
  switch (type) {
    case "Opening hours":
      return own?.seasons?.length ? { ...source, seasons: mergeItems(source.seasons, own.seasons, ["name"]) } : source;
    case "Special days":
      return Array.isArray(own) && own.length ? mergeItems(source, own, ["label"]) : source;
    case "Date ranges":
      return Array.isArray(own) && own.length ? mergeItems(source, own, ["label", "note"]) : source;
    case "Admission":
      return own?.type ? { ...source, note: own.note ?? "", prices: mergeItems(source.prices, own.prices, ["ticket", "note"]) } : source;
    default:
      return source;
  }
}

export const sharedFields = (type) => (type?.fields ?? []).filter(isSharedField);

// Nothing entered: no value, an empty text, list or group of empty parts.
export const isEmptyValue = (v) =>
  v == null || v === "" || (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.values(v).every((x) => x == null || x === ""));

// The value of `field` in the most recently updated of `entries` that has one.
export function latestValue(entries, field) {
  const holders = entries.filter((e) => !isEmptyValue(e.fieldValues?.[field]));
  holders.sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
  return holders[0]?.fieldValues[field];
}
