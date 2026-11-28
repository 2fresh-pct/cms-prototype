import { capEntriesHistory } from "./history";
import { nextTypeColor } from "./typeColors";
import { POI_TYPE, POI_TAXONOMIES, POI_MEDIA, POI_ENTRIES, POI_KEYWORD_TERMS, OLD_POI_KEYWORD_IDS } from "./poi";
import { DISCOVERY_CATEGORIES_ID, DISCOVERY_CATEGORIES_TAXONOMY } from "./discoveryCategories";
import { EVENT_CATEGORY_TERMS } from "./eventCategories";
import { fieldKeyFor, keyBase } from "./fieldKey";
import { sharedFields, isEmptyValue, latestValue } from "./sharedFields";
import { DEFAULT_WORKFLOW_STEPS, normalizeWorkflowSteps, normalizeEntryStatus } from "./seed";

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
    renameFieldKeys((ct, f) => {
      const label = (f.label ?? "").trim();
      if (!/^field\d+$/.test(f.name) || !keyBase(label) || label.toLowerCase() === "new field") return null;
      return label;
    });
  },
  // POI elements whose key no longer says what the element is called ("popis místa" was
  // `history`, "média" was `dalsiObrazky`): the keys follow the names now, in the type and
  // in the items that hold values under them. The fixed title and slug keep theirs.
  "poi-keys-from-names": () => {
    renameFieldKeys((ct, f) => {
      if (ct.id !== "ct-poi" || f.type === "Separator" || f.core === "title" || f.core === "slug") return null;
      const label = (f.label ?? "").trim();
      return keyBase(label) && keyBase(label) !== f.name ? label : null;
    });
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
  // The POI type's tabs "Otevírací doba" and "Vstupné" get the fields for opening
  // hours (regular hours by period, special days, temporary closure, a note, when
  // they were last checked) and for admission. Only a tab that has no fields yet is
  // filled, so nothing an editor modelled by hand is duplicated.
  "poi-opening-and-admission": () => {
    const raw = localStorage.getItem("cms.contentTypes");
    if (!raw) return; // not seeded yet
    const types = JSON.parse(raw);
    if (!Array.isArray(types)) return;
    const poi = types.find((ct) => ct.id === "ct-poi");
    const groups = poi?.groups ?? [];
    if (!poi || !groups.includes("Otevírací doba") || !groups.includes("Vstupné")) return;
    const used = new Set(poi.fields.map((f) => f.name));
    const plan = [
      ["Otevírací doba", [
        { label: "Pravidelná otevírací doba", type: "Opening hours" },
        { label: "Speciální dny", type: "Special days", localized: "partly" },
        { label: "Dočasné uzavření", type: "Date ranges" },
        { label: "Poznámka k otevírací době", type: "Short text", localized: true },
        { label: "Otevírací doba naposledy ověřena", type: "Date" },
      ]],
      ["Vstupné", [
        { label: "Vstupné", type: "Admission", localized: "partly" },
        { label: "Vstupné naposledy ověřeno", type: "Date" },
      ]],
    ];
    const added = [];
    for (const [group, defs] of plan) {
      if (poi.fields.some((f) => f.group === group)) continue;
      for (const def of defs) {
        const name = fieldKeyFor(def.label, used);
        used.add(name);
        added.push({ name, group, ...def });
      }
    }
    if (added.length === 0) return;
    localStorage.setItem("cms.contentTypes", JSON.stringify(types.map((ct) => (ct.id === "ct-poi" ? { ...ct, fields: [...ct.fields, ...added] } : ct))));
  },
  // Fields that are not localized hold one value for every language version, but
  // until now each version kept its own, so a new version started empty. Where a
  // version has nothing in such a field and another version of the item does, it is
  // filled from the most recently updated one. A version that has its own value, or
  // that is published, is left alone.
  "shared-fields-backfill": () => {
    const typesRaw = localStorage.getItem("cms.contentTypes");
    const entriesRaw = localStorage.getItem("cms.entries");
    if (!typesRaw || !entriesRaw) return; // not seeded yet
    const types = JSON.parse(typesRaw);
    const entries = JSON.parse(entriesRaw);
    if (!Array.isArray(types) || !Array.isArray(entries)) return;
    let steps = DEFAULT_WORKFLOW_STEPS;
    try { const raw = JSON.parse(localStorage.getItem("cms.settings.workflowSteps")); if (Array.isArray(raw)) steps = normalizeWorkflowSteps(raw); } catch { /* defaults */ }
    const publishId = steps[steps.length - 1]?.id;

    const groups = new Map();
    for (const e of entries) {
      const key = `${e.contentTypeId}::${e.groupId ?? e.id}`;
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    const fills = new Map(); // entry id -> { field: value }
    for (const members of groups.values()) {
      if (members.length < 2) continue;
      const type = types.find((ct) => ct.id === members[0].contentTypeId);
      for (const f of sharedFields(type)) {
        const value = latestValue(members, f.name);
        if (value === undefined) continue;
        for (const e of members) {
          if (!isEmptyValue(e.fieldValues?.[f.name]) || normalizeEntryStatus(e.status, steps) === publishId) continue;
          fills.set(e.id, { ...(fills.get(e.id) ?? {}), [f.name]: value });
        }
      }
    }
    if (fills.size === 0) return;
    localStorage.setItem("cms.entries", JSON.stringify(entries.map((e) => (fills.has(e.id) ? { ...e, fieldValues: { ...(e.fieldValues ?? {}), ...fills.get(e.id) } } : e))));
  },
  // The editors made a taxonomy called "Kategorie akcí" by hand. If it has no terms yet,
  // it gets the event categories.
  "event-categories": () => {
    const raw = localStorage.getItem("cms.taxonomies");
    if (!raw) return; // not seeded yet
    const taxonomies = JSON.parse(raw);
    if (!Array.isArray(taxonomies)) return;
    const fold = (x) => String(x ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
    let changed = false;
    const next = taxonomies.map((x) => {
      if (!fold(x.name).startsWith("kategorie akc") || (x.terms ?? []).length > 0) return x;
      changed = true;
      return { ...x, terms: EVENT_CATEGORY_TERMS };
    });
    if (changed) localStorage.setItem("cms.taxonomies", JSON.stringify(next));
  },
  // An item edited many times can carry hundreds of snapshots and fill the browser
  // storage on its own. Only the newest versions of each item are kept.
  "cap-history": () => {
    const raw = localStorage.getItem("cms.entries");
    if (!raw) return; // not seeded yet
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return;
    const capped = capEntriesHistory(entries);
    const next = JSON.stringify(capped);
    if (next.length < raw.length) localStorage.setItem("cms.entries", next);
  },
  // Czech is the default language of the content; a stored English default is replaced once.
  "default-locale-czech": () => {
    if (localStorage.getItem("cms.settings.defaultLocale") !== '"cs"') localStorage.setItem("cms.settings.defaultLocale", '"cs"');
  },
  // Subtitles and intro texts can run over several lines: where they are still one-line
  // text they become multi-line text. Matched by the name the element has.
  "multiline-subtitle-intro": () => {
    const raw = localStorage.getItem("cms.contentTypes");
    if (!raw) return; // not seeded yet
    const types = JSON.parse(raw);
    if (!Array.isArray(types)) return;
    const wanted = /podtitul|podnadpis|úvodní text|subtitle|intro text/i;
    let changed = false;
    const next = types.map((ct) => ({
      ...ct,
      fields: (ct.fields ?? []).map((f) => {
        if (f.type !== "Text" || f.core || !wanted.test(f.label ?? f.name ?? "")) return f;
        changed = true;
        return { ...f, type: "Short text" };
      }),
    }));
    if (changed) localStorage.setItem("cms.contentTypes", JSON.stringify(next));
  },
};

// Renames field keys. `labelFor(type, field)` returns the name the new key is built
// from, or null to leave the field alone. Values held under an old key (in items, their
// version history and their live version) move with it.
function renameFieldKeys(labelFor) {
  const typesRaw = localStorage.getItem("cms.contentTypes");
  if (!typesRaw) return; // not seeded yet: seeded fields have proper keys
  const types = JSON.parse(typesRaw);
  if (!Array.isArray(types)) return;
  const renames = {}; // content type id -> { old key: new key }
  const nextTypes = types.map((ct) => {
    const used = new Set(ct.fields.map((f) => f.name));
    const map = {};
    const fields = ct.fields.map((f) => {
      const label = labelFor(ct, f);
      if (!label) return f;
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
}

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
