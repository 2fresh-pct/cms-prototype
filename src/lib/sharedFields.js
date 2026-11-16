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

export const isSharedField = (f) =>
  !f.localized && !f.core && f.type !== "Separator" && f.type !== "ID" && !["title", "slug", "body"].includes(f.name);

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
