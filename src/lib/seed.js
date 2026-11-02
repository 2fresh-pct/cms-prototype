import { POI_TYPE, POI_TAXONOMIES, POI_MEDIA, POI_ENTRIES } from "./poi";

const USERS = [
  { id: "u1", name: "Petr Augustin", email: "petr.augustin@2fresh.cz", color: "#6366f1" },
  { id: "u2", name: "Lena Novak", email: "lena.novak@2fresh.cz", color: "#ec4899" },
  { id: "u3", name: "Marek Dvorak", email: "marek.dvorak@2fresh.cz", color: "#10b981" },
  { id: "u4", name: "Sofia Kral", email: "sofia.kral@2fresh.cz", color: "#f59e0b" },
];

const CONTENT_TYPES = [
  { id: "ct1", name: "Page — Landing", icon: "file-text", color: "#3b82f6" },
  { id: "ct2", name: "Page — Product", icon: "file-text", color: "#3b82f6" },
  { id: "ct3", name: "Component — SEO", icon: "gem", color: "#8b5cf6" },
  { id: "ct4", name: "Component — Hero", icon: "gem", color: "#8b5cf6" },
  { id: "ct5", name: "Article", icon: "newspaper", color: "#0ea5e9" },
];

const STATUSES = ["Published", "Draft", "Changed", "Archived"];
const LOCALES = ["en", "cs", "de"];

const WORKFLOW_COLORS = [
  "#9ca3af", // gray
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#10b981", // emerald
  "#14b8a6", // teal
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

const WORKFLOW_STEPS = [
  { id: "wf1", name: "Draft", color: WORKFLOW_COLORS[0] },
  { id: "wf2", name: "Copywriting", color: WORKFLOW_COLORS[3] },
  { id: "wf3", name: "Media", color: WORKFLOW_COLORS[6] },
  { id: "wf4", name: "Review 1", color: WORKFLOW_COLORS[8] },
  { id: "wf5", name: "Review 2", color: WORKFLOW_COLORS[9] },
  { id: "wf6", name: "Ready", color: WORKFLOW_COLORS[7] },
  { id: "wf7", name: "Published", color: WORKFLOW_COLORS[4] },
];

export function normalizeWorkflowSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return WORKFLOW_STEPS;
  return steps.map((s, i) =>
    typeof s === "string"
      ? { id: `step-${i}`, name: s, color: WORKFLOW_COLORS[i % WORKFLOW_COLORS.length] }
      : { id: s.id ?? `step-${i}`, name: s.name, color: s.color ?? WORKFLOW_COLORS[i % WORKFLOW_COLORS.length] }
  );
}

// Entries store the workflow step's id. Older data (from before the Workflow
// feature existed, or from before steps were keyed by id) may still hold a
// step's display name, or a stale value that matches no current step at all —
// fall back to the first step in that case rather than showing garbage.
export function normalizeEntryStatus(status, workflowSteps) {
  if (workflowSteps.some((s) => s.id === status)) return status;
  const byName = workflowSteps.find((s) => s.name === status);
  if (byName) return byName.id;
  return workflowSteps[0]?.id ?? status;
}

const CHANNELS = [
  { id: "ch1", name: "MyPrague app", icon: "smartphone", color: WORKFLOW_COLORS[6] },
  { id: "ch2", name: "PCT website", icon: "globe", color: WORKFLOW_COLORS[7] },
];

export function normalizeChannels(channels) {
  if (!Array.isArray(channels) || channels.length === 0) return CHANNELS;
  return channels.map((c, i) => ({
    id: c.id ?? `channel-${i}`,
    name: c.name,
    icon: c.icon ?? "radio",
    color: c.color ?? WORKFLOW_COLORS[i % WORKFLOW_COLORS.length],
  }));
}

// An entry's `channels` field is either the sentinel "ALL" (publish everywhere,
// including channels added later) or a single specific channel id. There is no
// "no channels" or "multiple specific channels" state — content is either
// everywhere, or on exactly one named channel.
export const ALL_CHANNELS = "ALL";

export function isAllChannels(value) {
  return value == null || value === ALL_CHANNELS;
}

// An entry's channels are "ALL", a single channel id (older data), or an
// array of channel ids picked in the publish dialog.
export function resolvePublishedChannelIds(value, allChannels) {
  if (!isAllChannels(value)) {
    const wanted = Array.isArray(value) ? value : [value];
    const matches = allChannels.filter((c) => wanted.includes(c.id)).map((c) => c.id);
    if (matches.length > 0) return matches;
  }
  // ALL, or a stale/unknown value (e.g. channels that no longer exist) — treat as ALL
  // rather than ever resolving to zero channels.
  return allChannels.map((c) => c.id);
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function daysAgo(n) {
  const day = String(Math.max(1, 12 - n)).padStart(2, "0");
  const hour = String(9 + (n % 8)).padStart(2, "0");
  const minute = String((n * 7) % 60).padStart(2, "0");
  return `2026-08-${day}T${hour}:${minute}:00`;
}

const ENTRY_NAMES = [
  "Homepage", "About us", "Contact", "Pricing", "SEO, homepage", "SEO, about page",
  "Hero, homepage", "Hero, pricing", "Wireless headphones", "SEO, wireless headphones",
  "Running shoes — trail", "SEO, running shoes", "Canvas backpack", "SEO, canvas backpack",
  "Ceramic mug set", "SEO, ceramic mug set", "How we source materials", "Behind the scenes: warehouse",
  "Sustainability report 2026", "Product care guide", "Winter jacket — men", "SEO, winter jacket",
  "Desk lamp, oak", "SEO, desk lamp", "Hero, product listing", "Loyalty program", "Gift cards",
  "Return policy", "Shipping & delivery", "Store locator", "Careers", "Press kit",
  "SEO, careers", "Hero, careers", "Notebook, dotted", "SEO, notebook", "Water bottle, steel",
  "SEO, water bottle", "New arrivals — autumn", "Customer stories", "Size guide",
];

function pickEntryStatus(i) {
  const last = WORKFLOW_STEPS.length - 1;
  if (i % 17 === 0) return WORKFLOW_STEPS[1]?.id ?? WORKFLOW_STEPS[0].id;
  if (i % 13 === 0) return WORKFLOW_STEPS[2]?.id ?? WORKFLOW_STEPS[0].id;
  if (i % 11 === 0) return WORKFLOW_STEPS[Math.min(3, last)].id;
  if (i % 9 === 0) return WORKFLOW_STEPS[Math.min(4, last)].id;
  if (i % 7 === 0) return WORKFLOW_STEPS[Math.min(5, last)].id;
  if (i % 5 === 0) return WORKFLOW_STEPS[0].id;
  return WORKFLOW_STEPS[last].id;
}

function pickEntryChannels(i) {
  if (i % 6 === 0) return "ch1"; // MyPrague app only
  if (i % 8 === 0) return "ch2"; // PCT website only
  return ALL_CHANNELS;
}

// A content item's language versions are independent entries linked by
// groupId — each has its own status/workflow/history, not a shared field.
const SIBLING_LOCALE = { en: "cs", cs: "de", de: "en" };

export function seedEntries() {
  const base = ENTRY_NAMES.map((name, i) => {
    const typeIdx = name.startsWith("SEO") ? 2 : name.startsWith("Hero") ? 3
      : ["How we source", "Behind the scenes", "Sustainability", "Customer stories"].some(p => name.startsWith(p)) ? 4
      : i % 5;
    const id = `e${i + 1}`;
    return {
      id,
      groupId: id,
      title: name,
      contentTypeId: CONTENT_TYPES[typeIdx % CONTENT_TYPES.length].id,
      status: pickEntryStatus(i),
      locale: pick(LOCALES, i),
      channels: pickEntryChannels(i),
      updatedAt: daysAgo(i % 10),
      updatedBy: pick(USERS, i).id,
    };
  });

  // A handful of entries also have a translated sibling, to demo linked
  // language versions each moving through their own workflow.
  const siblings = base
    .filter((_, i) => i % 4 === 0)
    .map((e, j) => ({
      id: `${e.id}t`,
      groupId: e.groupId,
      title: e.title,
      contentTypeId: e.contentTypeId,
      status: WORKFLOW_STEPS[0].id,
      locale: SIBLING_LOCALE[e.locale] ?? "en",
      channels: e.channels,
      updatedAt: daysAgo((j * 3 + 2) % 10),
      updatedBy: pick(USERS, j + 2).id,
    }));

  return [...base, ...siblings, ...POI_ENTRIES];
}

const CATALOGUE_CATEGORIES = [
  { id: "cat1", name: "Featured", count: 12 },
  { id: "cat2", name: "Locations", count: 34 },
  { id: "cat3", name: "Events", count: 58 },
  { id: "cat4", name: "Products", count: 91 },
  { id: "cat5", name: "Guides", count: 17 },
];

const EVENT_NAMES = [
  "Summer music festival", "Night food market", "Rooftop cinema series", "Craft beer weekend",
  "Farmers market — Saturday", "Live jazz sessions", "Vintage flea market", "Charity fun run",
  "Art walk — downtown", "Kids workshop: pottery", "Street food carnival", "Open-air theatre",
  "Photography exhibition", "New Year fireworks", "Wine tasting evening", "Bike tour — old town",
];

export function seedCatalogueCategories() {
  return CATALOGUE_CATEGORIES;
}

export function seedCatalogueItems() {
  const items = [];
  let idx = 0;
  for (const cat of CATALOGUE_CATEGORIES) {
    const count = cat.count;
    for (let i = 0; i < count; i++) {
      const name = cat.id === "cat3"
        ? i < EVENT_NAMES.length ? EVENT_NAMES[i] : `${EVENT_NAMES[i % EVENT_NAMES.length]} (${Math.floor(i / EVENT_NAMES.length) + 1})`
        : `${cat.name} item ${i + 1}`;
      items.push({
        id: `ci${idx + 1}`,
        categoryId: cat.id,
        name,
        status: pick(STATUSES, idx % 8 === 0 ? 1 : 0),
        url: `/en/${cat.name.toLowerCase()}/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}/`,
        locale: pick(LOCALES, idx),
        updatedAt: daysAgo(idx % 10),
        lastReviewedAt: idx % 3 === 0 ? "" : daysAgo((idx % 10) + 1),
        authorId: pick(USERS, idx).id,
      });
      idx++;
    }
  }
  return items;
}

const MEDIA_NAMES = [
  "hero-banner-autumn.jpg", "product-headphones-front.png", "product-headphones-side.png",
  "warehouse-team.jpg", "backpack-lifestyle.jpg", "mug-set-flatlay.jpg", "jacket-model-01.jpg",
  "jacket-model-02.jpg", "desk-lamp-oak.png", "notebook-cover.jpg", "bottle-steel-blue.png",
  "store-front-prague.jpg", "careers-team-photo.jpg", "press-kit-logo.svg", "size-guide-chart.png",
  "sustainability-cover.jpg",
];

export function seedMedia() {
  return [...seedGenericMedia(), ...POI_MEDIA];
}

function seedGenericMedia() {
  return MEDIA_NAMES.map((name, i) => ({
    id: `m${i + 1}`,
    name,
    kind: name.endsWith(".svg") ? "vector" : name.endsWith(".png") ? "image/png" : "image/jpeg",
    sizeKb: 80 + ((i * 37) % 900),
    updatedAt: daysAgo(i % 10),
    uploadedBy: pick(USERS, i + 2).id,
    color: pick(["#fca5a5", "#93c5fd", "#a7f3d0", "#fcd34d", "#c4b5fd", "#fda4af"], i),
  }));
}

const CONTENT_TYPE_DEFS = CONTENT_TYPES.map((ct, i) => ({
  ...ct,
  fields: i < 2
    ? [{ name: "title", type: "Text" }, { name: "slug", type: "Text" }, { name: "body", type: "Rich text" }, { name: "seo", type: "Reference" }]
    : i === 2
      ? [{ name: "metaTitle", type: "Text" }, { name: "metaDescription", type: "Text" }, { name: "ogImage", type: "Media", multiple: false }]
      : i === 3
        ? [{ name: "headline", type: "Text" }, { name: "image", type: "Media", multiple: false }, { name: "cta", type: "Text" }]
        : [{ name: "title", type: "Text" }, { name: "author", type: "Text" }, { name: "body", type: "Rich text" }],
  entryCount: 0,
}));

export function seedContentTypes() {
  const entries = seedEntries();
  return [...CONTENT_TYPE_DEFS, POI_TYPE].map(ct => ({
    ...ct,
    entryCount: entries.filter(e => e.contentTypeId === ct.id).length,
  }));
}

function term(id, name, children = []) {
  return { id, name, children };
}

const TAXONOMIES = [
  {
    id: "tax1",
    name: "Location",
    description: "Where in Prague this content relates to.",
    terms: [
      term("loc-prague", "Prague", [
        term("loc-old-town", "Old Town"),
        term("loc-new-town", "New Town"),
        term("loc-vinohrady", "Vinohrady"),
        term("loc-karlin", "Karlín"),
      ]),
      term("loc-brno", "Brno", [
        term("loc-brno-center", "City Center"),
      ]),
    ],
  },
  {
    id: "tax2",
    name: "Event type",
    description: "What kind of event or activity this is.",
    terms: [
      term("evt-culture", "Culture", [
        term("evt-music", "Music"),
        term("evt-theatre", "Theatre"),
        term("evt-exhibition", "Exhibition"),
      ]),
      term("evt-sports", "Sports", [
        term("evt-running", "Running"),
        term("evt-cycling", "Cycling"),
      ]),
      term("evt-family", "Family"),
    ],
  },
];

export function seedTaxonomies() {
  return [...TAXONOMIES, ...POI_TAXONOMIES];
}

export function countTerms(terms) {
  return terms.reduce((sum, t) => sum + 1 + countTerms(t.children), 0);
}

export function flattenTerms(terms, depth = 0) {
  return terms.flatMap((t) => [{ id: t.id, name: t.name, depth }, ...flattenTerms(t.children, depth + 1)]);
}

export function updateTermInTree(terms, id, patch) {
  return terms.map((t) =>
    t.id === id ? { ...t, ...patch } : { ...t, children: updateTermInTree(t.children, id, patch) }
  );
}

export function addTermToTree(terms, parentId, newTerm) {
  if (parentId === null) return [...terms, newTerm];
  return terms.map((t) =>
    t.id === parentId ? { ...t, children: [...t.children, newTerm] } : { ...t, children: addTermToTree(t.children, parentId, newTerm) }
  );
}

export function removeTermFromTree(terms, id) {
  return terms.filter((t) => t.id !== id).map((t) => ({ ...t, children: removeTermFromTree(t.children, id) }));
}

export function moveTermInTree(terms, id, dir) {
  const idx = terms.findIndex((t) => t.id === id);
  if (idx !== -1) {
    const j = idx + dir;
    if (j < 0 || j >= terms.length) return terms;
    const next = [...terms];
    [next[idx], next[j]] = [next[j], next[idx]];
    return next;
  }
  return terms.map((t) => ({ ...t, children: moveTermInTree(t.children, id, dir) }));
}

export function seedUsers() {
  return USERS;
}

export function getUser(id) {
  return USERS.find(u => u.id === id) || USERS[0];
}

export const STATUS_LIST = STATUSES;
export const LOCALE_LIST = LOCALES;
export const LOCALE_LABELS = { en: "EN", cs: "CZ", de: "DE" };
export const LOCALE_NAMES = { en: "English", cs: "Czech", de: "German" };

// Every entry belongs to a group of linked language versions (siblings),
// each an independent entry with its own workflow/history. Entries seeded
// before this field existed default to a group of one (their own id).
export function normalizeEntryGroupId(entry) {
  return entry.groupId ?? entry.id;
}

export const FIELD_TYPE_LIST = [
  "Text", "Short text", "Rich text", "Number", "Boolean", "Select", "Date",
  "Media", "Media list", "Reference", "Taxonomy",
  "Link", "Text list", "Key-value", "Date ranges", "Sections",
  "Address", "Coordinates", "Opening hours", "ID",
];
export const DEFAULT_WORKFLOW_STEPS = WORKFLOW_STEPS;
export const WORKFLOW_COLOR_PALETTE = WORKFLOW_COLORS;
export const DEFAULT_CHANNELS = CHANNELS;
