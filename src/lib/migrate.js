import { nextTypeColor } from "./typeColors";
import { POI_TYPE, POI_TAXONOMIES, POI_MEDIA, POI_ENTRIES, POI_KEYWORD_TERMS, OLD_POI_KEYWORD_IDS } from "./poi";
import { DISCOVERY_CATEGORIES_ID, DISCOVERY_CATEGORIES_TAXONOMY } from "./discoveryCategories";
import { fieldKeyFor, keyBase } from "./fieldKey";

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
  // The Keywords ("štítky") taxonomy takes the full list of public labels from
  // the old CMS. Its name and description stay as they are. A term that is
  // already there keeps its id (matched by name), so items that use it keep their
  // value; a term that is not in the new list is kept at the end rather than lost.
  "poi-keywords-list": () => {
    const raw = localStorage.getItem("cms.taxonomies");
    if (!raw) return; // not seeded yet: the seed already has the full list
    const taxonomies = JSON.parse(raw);
    if (!Array.isArray(taxonomies)) return;
    const keywords = taxonomies.find((x) => x.id === "poi-keywords");
    if (!keywords) return;
    const existing = keywords.terms ?? [];
    const idByName = new Map(existing.map((term) => [term.name.trim().toLowerCase(), term.id]));
    const terms = POI_KEYWORD_TERMS.map((term) => ({ ...term, id: idByName.get(term.name.toLowerCase()) ?? term.id }));
    const kept = new Set(terms.map((term) => term.id));
    const extra = existing.filter((term) => !kept.has(term.id));
    localStorage.setItem("cms.taxonomies", JSON.stringify(taxonomies.map((x) => (x.id === "poi-keywords" ? { ...x, terms: [...terms, ...extra] } : x))));
  },
  // The "Kategorie objevů" taxonomy (the old CMS's category tree) is added, and
  // the fields labelled "Kategorie objevů" that were pointing at the placeholder
  // "Location" taxonomy now use it. Values already picked in those fields refer to
  // Location terms and are left in the entries; they just no longer match a term.
  "discovery-categories": () => {
    mergeById("cms.taxonomies", [DISCOVERY_CATEGORIES_TAXONOMY]);
    const raw = localStorage.getItem("cms.contentTypes");
    if (!raw) return; // not seeded yet
    const types = JSON.parse(raw);
    if (!Array.isArray(types)) return;
    let changed = false;
    const next = types.map((ct) => ({
      ...ct,
      fields: ct.fields.map((f) => {
        if (f.type !== "Taxonomy" || f.taxonomyId !== "tax1" || (f.label ?? "").trim().toLowerCase() !== "kategorie objevů") return f;
        changed = true;
        return { ...f, taxonomyId: DISCOVERY_CATEGORIES_ID };
      }),
    }));
    if (changed) localStorage.setItem("cms.contentTypes", JSON.stringify(next));
  },
  // Fields made before keys came from names have keys like "field7". Each one
  // whose name says something gets the key its name stands for ("podnadpis" ->
  // podnadpis, "hlavní obrázek" -> hlavniObrazek), and the values held under the
  // old key (in items, their version history and their live version) move with it.
  // Fields still called "New field" keep theirs.
  "field-keys-from-names": () => {
    const typesRaw = localStorage.getItem("cms.contentTypes");
    if (!typesRaw) return; // not seeded yet: seeded fields have proper keys
    const types = JSON.parse(typesRaw);
    if (!Array.isArray(types)) return;
    const renames = {}; // content type id -> { old key: new key }
    const nextTypes = types.map((ct) => {
      const used = new Set(ct.fields.map((f) => f.name));
      const map = {};
      const fields = ct.fields.map((f) => {
        const label = (f.label ?? "").trim();
        if (!/^field\d+$/.test(f.name) || !keyBase(label) || label.toLowerCase() === "new field") return f;
        used.delete(f.name);
        const key = fieldKeyFor(label, used);
        used.add(key);
        if (key === f.name) return f;
        map[f.name] = key;
        return { ...f, name: key };
      });
      renames[ct.id] = map;
      return { ...ct, fields };
    });

    const entriesRaw = localStorage.getItem("cms.entries");
    let nextEntries = null;
    if (entriesRaw) {
      const entries = JSON.parse(entriesRaw);
      if (Array.isArray(entries)) {
        nextEntries = entries.map((e) => {
          const map = renames[e.contentTypeId];
          if (!map || Object.keys(map).length === 0) return e;
          const remap = (values) => (values ? Object.fromEntries(Object.entries(values).map(([k, v]) => [map[k] ?? k, v])) : values);
          const next = { ...e };
          if (e.fieldValues) next.fieldValues = remap(e.fieldValues);
          if (e.live?.fieldValues) next.live = { ...e.live, fieldValues: remap(e.live.fieldValues) };
          if (Array.isArray(e.history)) {
            next.history = e.history.map((h) => (h.snapshot?.fieldValues ? { ...h, snapshot: { ...h.snapshot, fieldValues: remap(h.snapshot.fieldValues) } } : h));
          }
          return next;
        });
      }
    }
    // Both are worked out before either is written, so a failure leaves them in step.
    if (nextEntries) localStorage.setItem("cms.entries", JSON.stringify(nextEntries));
    localStorage.setItem("cms.contentTypes", JSON.stringify(nextTypes));
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
