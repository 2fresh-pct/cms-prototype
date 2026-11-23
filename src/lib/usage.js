import { normalizeEntryGroupId } from "./seed";

// Where a content item is used: which other items link to it in a Reference field
// or embed it as a component in rich text. Versions of an item in other languages
// count as the same item (each language version links by its own id), and several
// language versions of the linking item are listed once, with their languages.
//
// Returns [{ entry, locales, how }], `entry` being the version in `locale` when there
// is one (else the first found), `how` a list of "linked" and "embedded".
export function usedIn(entry, entries, contentTypes, locale) {
  const group = normalizeEntryGroupId(entry);
  const ids = new Set(entries.filter((e) => normalizeEntryGroupId(e) === group).map((e) => e.id));
  const embeds = (html) => typeof html === "string" && [...ids].some((id) => html.includes(`data-content-item="${id}"`));

  const byGroup = new Map();
  for (const other of entries) {
    const otherGroup = normalizeEntryGroupId(other);
    if (otherGroup === group) continue;
    const type = contentTypes.find((ct) => ct.id === other.contentTypeId);
    const how = new Set();
    for (const f of type?.fields ?? []) {
      const v = other.fieldValues?.[f.name];
      if (f.type === "Reference" && Array.isArray(v) && v.some((id) => ids.has(id))) how.add("linked");
      if (f.type === "Rich text" && embeds(v)) how.add("embedded");
    }
    if (embeds(other.body)) how.add("embedded");
    if (how.size === 0) continue;

    const found = byGroup.get(otherGroup) ?? { entries: [], how: new Set() };
    found.entries.push(other);
    how.forEach((h) => found.how.add(h));
    byGroup.set(otherGroup, found);
  }

  return [...byGroup.values()]
    .map((g) => ({
      entry: g.entries.find((e) => e.locale === locale) ?? g.entries[0],
      locales: g.entries.map((e) => e.locale).filter(Boolean),
      how: [...g.how],
    }))
    .sort((a, b) => a.entry.title.localeCompare(b.entry.title));
}
