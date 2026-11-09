import { nextTypeColor } from "./typeColors";
import { POI_TYPE, POI_TAXONOMIES, POI_MEDIA, POI_ENTRIES, POI_KEYWORD_TERMS, OLD_POI_KEYWORD_IDS } from "./poi";

// Seed data only reaches localStorage on first load, so people who already
// have a prototype in their browser would never see content added to the seed
// later. Each migration runs once and merges its new items in by id, leaving
// anything already there (including edits and deletions of earlier items) alone.
const MIGRATIONS_KEY = "cms.migrations";

const MIGRATIONS = {
  "poi-content-type": () => {
    mergeById("cms.contentTypes", [POI_TYPE]);
    mergeById("cms.taxonomies", POI_TAXONOMIES);
    mergeById("cms.media", POI_MEDIA);
    mergeById("cms.entries", POI_ENTRIES);
  },
  // The Keywords taxonomy now holds the Czech terms from the editors. A saved
  // Keywords taxonomy that still has exactly the old terms is replaced; entries that
  // used an old term move to its equivalent (or lose it if there is none). One the
  // editors have already changed is left alone.
  "poi-keywords-czech": () => {
    const raw = localStorage.getItem("cms.taxonomies");
    if (!raw) return; // not seeded yet: the seed already has the new terms
    const taxonomies = JSON.parse(raw);
    if (!Array.isArray(taxonomies)) return;
    const keywords = taxonomies.find((x) => x.id === "poi-keywords");
    const oldIds = Object.keys(OLD_POI_KEYWORD_IDS);
    const untouched = keywords && keywords.terms?.length === oldIds.length && oldIds.every((id) => keywords.terms.some((term) => term.id === id));
    if (!untouched) return;
    localStorage.setItem("cms.taxonomies", JSON.stringify(taxonomies.map((x) => (x.id === "poi-keywords" ? { ...x, terms: POI_KEYWORD_TERMS } : x))));

    const typesRaw = localStorage.getItem("cms.contentTypes");
    const entriesRaw = localStorage.getItem("cms.entries");
    if (!typesRaw || !entriesRaw) return;
    const fieldNames = new Set(JSON.parse(typesRaw).flatMap((ct) => ct.fields.filter((f) => f.taxonomyId === "poi-keywords").map((f) => f.name)));
    const entries = JSON.parse(entriesRaw);
    if (!Array.isArray(entries)) return;
    const moved = entries.map((e) => {
      if (!e.fieldValues) return e;
      let changed = false;
      const fieldValues = { ...e.fieldValues };
      for (const name of fieldNames) {
        if (!Array.isArray(fieldValues[name])) continue;
        const next = [...new Set(fieldValues[name].map((id) => (id in OLD_POI_KEYWORD_IDS ? OLD_POI_KEYWORD_IDS[id] : id)).filter(Boolean))];
        if (next.length !== fieldValues[name].length || next.some((id, i) => id !== fieldValues[name][i])) { fieldValues[name] = next; changed = true; }
      }
      return changed ? { ...e, fieldValues } : e;
    });
    localStorage.setItem("cms.entries", JSON.stringify(moved));
  },
  // Every content type's icon gets its own colour: a type that shares a colour
  // with one earlier in the list is given the next unused one.
  "distinct-type-colors": () => {
    const raw = localStorage.getItem("cms.contentTypes");
    if (!raw) return; // not seeded yet: the seed colours are already distinct
    const types = JSON.parse(raw);
    if (!Array.isArray(types)) return;
    const seen = new Set();
    const used = new Set(types.map((ct) => (ct.color ?? "").toLowerCase()));
    const next = types.map((ct) => {
      const key = (ct.color ?? "").toLowerCase();
      if (key && !seen.has(key)) { seen.add(key); return ct; }
      const color = nextTypeColor(used);
      used.add(color);
      seen.add(color);
      return { ...ct, color };
    });
    localStorage.setItem("cms.contentTypes", JSON.stringify(next));
  },
  // Media fields now hold several files unless set to `multiple: false`, so the
  // seeded fields that are meant to hold one file are pinned to a single file.
  "media-single-fields": () => {
    const single = { "ct-poi": ["primaryImage", "mapIllustration"], ct3: ["ogImage"], ct4: ["image"] };
    const raw = localStorage.getItem("cms.contentTypes");
    if (!raw) return; // not seeded yet: the seed already pins them
    const types = JSON.parse(raw);
    if (!Array.isArray(types)) return;
    const next = types.map((ct) => ({
      ...ct,
      fields: ct.fields.map((f) =>
        f.type === "Media" && f.multiple === undefined && single[ct.id]?.includes(f.name) ? { ...f, multiple: false } : f
      ),
    }));
    localStorage.setItem("cms.contentTypes", JSON.stringify(next));
  },
};

function mergeById(key, items) {
  const raw = localStorage.getItem(key);
  if (!raw) return; // not seeded yet: the seed already includes these items
  const stored = JSON.parse(raw);
  if (!Array.isArray(stored)) return;
  const have = new Set(stored.map((x) => x.id));
  const missing = items.filter((x) => !have.has(x.id));
  if (missing.length > 0) localStorage.setItem(key, JSON.stringify([...stored, ...missing]));
}

export function runMigrations() {
  try {
    const done = new Set(JSON.parse(localStorage.getItem(MIGRATIONS_KEY) ?? "[]"));
    for (const [name, run] of Object.entries(MIGRATIONS)) {
      if (done.has(name)) continue;
      run();
      done.add(name);
    }
    localStorage.setItem(MIGRATIONS_KEY, JSON.stringify([...done]));
  } catch {
    /* storage unavailable or corrupt: the app falls back to seed data */
  }
}
