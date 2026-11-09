// POI content type, modelled from docs/content-model/content-types/catalog/poi.md
// in svidma/PCT. Field names are the documented API names; `label` is what
// editors see. `required` is true | "conditional"; `localized` is true | "partly".
// Kept free of imports from seed.js (seed.js imports this file).

const field = (name, label, type, group, opts = {}) => ({ name, label, type, group, ...opts });

export const POI_FIELDS = [
  // Rendered in the editor's fixed title / slug / body slots.
  field("slug", "Slug", "Text", null, { core: "slug", required: true, localized: true }),
  field("name", "Name", "Text", null, { core: "title", required: true, localized: true }),
  field("description", "Description", "Rich text", null, { core: "body", required: true, localized: true }),

  field("identifier", "Identifier", "ID", "Content", { required: true }),
  field("summary", "Summary", "Short text", "Content", { localized: true }),
  field("history", "History", "Rich text", "Content", { localized: true }),
  field("contentSections", "Content sections", "Sections", "Content", { localized: true }),
  field("primaryImage", "Primary image", "Media", "Content", { localized: "partly", multiple: false }),
  field("image", "Images", "Media list", "Content", { localized: "partly" }),
  field("virtualTour", "Virtual tour", "Link", "Content", { localized: true }),
  field("mapIllustration", "Map illustration", "Media", "Content", { localized: "partly", multiple: false }),

  field("address", "Address", "Address", "Location", { localized: "partly" }),
  field("geo", "Coordinates", "Coordinates", "Location"),
  field("administrativeArea", "Administrative area", "Taxonomy", "Location", {
    taxonomyId: "poi-area", multiple: false, localized: "partly",
  }),

  field("openingHoursSpecification", "Opening hours", "Opening hours", "Visit information", { required: "conditional" }),
  field("specialOpeningHoursSpecification", "Special opening hours", "Date ranges", "Visit information"),
  field("seasonalClosure", "Seasonal closure", "Date ranges", "Visit information"),
  field("temporaryClosure", "Temporary closure", "Date ranges", "Visit information"),
  field("openingHoursNote", "Opening hours note", "Short text", "Visit information", { localized: true }),
  field("estimatedVisitDuration", "Estimated visit duration", "Number", "Visit information", { unit: "min" }),
  field("goodToKnow", "Good to know", "Text list", "Visit information", { localized: true }),
  field("offers", "Offers", "Reference", "Visit information", { localized: "partly", targetName: "Product — Entry ticket" }),
  field("accessibility", "Accessibility", "Taxonomy", "Visit information", {
    taxonomyId: "poi-accessibility", multiple: true, localized: "partly",
  }),
  field("telephone", "Telephone", "Text list", "Visit information"),
  field("email", "Email", "Text list", "Visit information"),
  field("url", "Website", "Text", "Visit information", { localized: "partly" }),

  field("primaryCategory", "Primary category", "Taxonomy", "Classification", {
    taxonomyId: "poi-category", multiple: false, required: true, localized: "partly",
  }),
  field("additionalCategories", "Additional categories", "Taxonomy", "Classification", {
    taxonomyId: "poi-category", multiple: true, localized: "partly",
  }),
  field("keywords", "Keywords", "Taxonomy", "Classification", {
    taxonomyId: "poi-keywords", multiple: true, localized: "partly",
  }),
  field("amenityFeature", "Amenities", "Taxonomy", "Classification", {
    taxonomyId: "poi-amenities", multiple: true, localized: "partly",
  }),
  field("touristType", "Tourist type", "Taxonomy", "Classification", {
    taxonomyId: "poi-tourist-type", multiple: true, localized: "partly",
  }),
  field("editorialLabels", "Editorial labels", "Taxonomy", "Classification", {
    taxonomyId: "poi-editorial-labels", multiple: true, localized: "partly",
  }),
  field("personalizationAttributes", "Personalization attributes", "Key-value", "Classification", { localized: "partly" }),
  field("pctPriority", "PCT priority", "Select", "Classification", {
    options: ["Normal", "Increased", "Reduced"], defaultValue: "Normal",
  }),
  field("pctPriorityValidFrom", "Priority valid from", "Date", "Classification"),
  field("pctPriorityValidThrough", "Priority valid through", "Date", "Classification"),
];

export const POI_TYPE_ID = "ct-poi";

export const POI_TYPE = {
  id: POI_TYPE_ID,
  name: "POI",
  icon: "map-pin",
  color: "#0d9488",
  fields: POI_FIELDS,
  entryCount: 0,
};

const term = (id, name, children = []) => ({ id, name, children });
const flat = (prefix, names) => names.map((n) => term(`${prefix}-${n.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, n));

// The Keywords taxonomy. The ids are fixed (not derived from the Czech names).
export const POI_KEYWORD_TERMS = [
  term("kw-gotika", "gotika"),
  term("kw-historizujici-slohy", "historizující slohy"),
  term("kw-instituce-hl-m-prahy", "instituce zřizovaná hl. m. prahou"),
  term("kw-pro-deti", "pro děti"),
  term("kw-renesance", "renesance"),
  term("kw-romansky-sloh", "románský sloh"),
];

// The Keywords it held before, and where each one went when they were replaced
// (null: no equivalent). Used to move saved content over; see migrate.js.
export const OLD_POI_KEYWORD_IDS = {
  "kw-unesco": null, "kw-gothic": "kw-gotika", "kw-baroque": null, "kw-views": null,
  "kw-free-entry": null, "kw-family-friendly": "kw-pro-deti", "kw-rainy-day": null, "kw-art-nouveau": null,
};

export const POI_TAXONOMIES = [
  {
    id: "poi-category",
    name: "POI category",
    description: "What kind of place a POI is. One primary category, any number of additional ones.",
    terms: [
      term("pc-sights", "Sights", [
        term("pc-castles", "Castles & palaces"),
        term("pc-monuments", "Bridges & monuments"),
        term("pc-viewpoints", "Viewpoints"),
      ]),
      term("pc-museums", "Museums & galleries"),
      term("pc-food", "Food & drink", [term("pc-restaurants", "Restaurants"), term("pc-cafes", "Cafés")]),
      term("pc-shops", "Shops"),
      term("pc-parks", "Parks & gardens"),
      term("pc-culture", "Cultural venues"),
      term("pc-visitor", "Visitor centres"),
    ],
  },
  {
    id: "poi-area",
    name: "Administrative area",
    description: "The Prague district a POI is in.",
    terms: flat("area", ["Praha 1", "Praha 2", "Praha 3", "Praha 5", "Praha 6", "Praha 7"]),
  },
  {
    id: "poi-keywords",
    name: "Keywords",
    description: "Free-form descriptive terms used for search.",
    terms: POI_KEYWORD_TERMS,
  },
  {
    id: "poi-amenities",
    name: "Amenities",
    description: "Facilities available at a place.",
    terms: flat("am", ["Toilets", "Cloakroom", "Gift shop", "Café on site", "Wi-Fi", "Audio guide", "Parking"]),
  },
  {
    id: "poi-accessibility",
    name: "Accessibility features",
    description: "Accessibility profile of a place.",
    terms: flat("acc", [
      "Step-free access", "Accessible toilet", "Lift", "Guide dogs welcome", "Hearing loop", "Tactile information",
    ]),
  },
  {
    id: "poi-tourist-type",
    name: "Tourist type",
    description: "Audiences a place suits, used for personalization.",
    terms: flat("tt", ["Families", "Couples", "Solo travellers", "Culture lovers", "Foodies", "Active travellers"]),
  },
  {
    id: "poi-editorial-labels",
    name: "Editorial labels",
    description: "Labels the editors use to highlight places.",
    terms: flat("el", ["Hidden gem", "Must see", "Local favourite", "New"]),
  },
];

export const POI_MEDIA = [
  ["poi-prague-castle.jpg", "image/jpeg"],
  ["poi-charles-bridge.jpg", "image/jpeg"],
  ["poi-national-museum.jpg", "image/jpeg"],
  ["poi-petrin-tower.jpg", "image/jpeg"],
  ["poi-letna-park.jpg", "image/jpeg"],
  ["poi-rudolfinum.jpg", "image/jpeg"],
  ["map-castle-district.png", "image/png"],
].map(([name, kind], i) => ({
  id: `m-poi-${i + 1}`,
  name,
  kind,
  sizeKb: 240 + i * 61,
  updatedAt: "2026-08-04T10:00:00",
  uploadedBy: "u2",
  color: ["#fca5a5", "#93c5fd", "#a7f3d0", "#fcd34d", "#c4b5fd", "#fda4af", "#d1d5db"][i],
}));

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const hours = (open, close, closedDays = []) =>
  Object.fromEntries(DAYS.map((d) => [d, closedDays.includes(d) ? null : { open, close }]));

const address = (street, postalCode) => ({ street, postalCode, city: "Praha", country: "Czechia" });

function poi(id, title, status, updatedBy, updatedAt, body, values, extra = {}) {
  return {
    id,
    groupId: extra.groupId ?? id,
    title,
    contentTypeId: POI_TYPE_ID,
    status,
    locale: extra.locale ?? "en",
    channels: "ALL",
    updatedAt,
    updatedBy,
    body,
    fieldValues: { identifier: id, pctPriority: "Normal", ...values },
  };
}

// Sample data only — hours and contact details are illustrative.
export const POI_ENTRIES = [
  poi("poi-castle", "Prague Castle", "wf7", "u1", "2026-08-11T09:10:00",
    "The largest ancient castle complex in the world and the seat of Czech heads of state for over a thousand years. Wander through courtyards, St Vitus Cathedral, the Old Royal Palace and Golden Lane.",
    {
      summary: "A thousand years of Czech history on one hill above the city.",
      history: "Founded around 880 and expanded by almost every ruler since. St Vitus Cathedral took nearly 600 years to complete.",
      contentSections: [
        { heading: "St Vitus Cathedral", text: "The Gothic cathedral is the spiritual heart of the castle and holds the Czech crown jewels." },
        { heading: "Golden Lane", text: "A row of tiny coloured houses built into the castle wall." },
      ],
      primaryImage: "m-poi-1",
      image: ["m-poi-1", "m-poi-7"],
      mapIllustration: "m-poi-7",
      virtualTour: { url: "https://www.hrad.cz/en/virtual-tour", label: "Explore the castle in 360°" },
      address: address("Hradčany", "119 08"),
      geo: { lat: "50.0909", lng: "14.4005" },
      administrativeArea: ["area-praha-1"],
      openingHoursSpecification: hours("09:00", "17:00"),
      specialOpeningHoursSpecification: [{ from: "2026-12-24", to: "2026-12-24", note: "9:00–14:00" }],
      openingHoursNote: "Last entry 30 minutes before closing.",
      estimatedVisitDuration: "180",
      goodToKnow: ["Security check at every entrance", "Free to enter the castle grounds", "Tickets cover the main historic buildings"],
      accessibility: ["acc-step-free-access", "acc-accessible-toilet"],
      telephone: ["+420 224 372 423"],
      email: ["visits@hrad.example"],
      url: "https://www.hrad.cz",
      primaryCategory: ["pc-castles"],
      additionalCategories: ["pc-sights"],
      keywords: ["kw-gotika"],
      amenityFeature: ["am-toilets", "am-gift-shop", "am-audio-guide"],
      touristType: ["tt-culture-lovers", "tt-families"],
      editorialLabels: ["el-must-see"],
      personalizationAttributes: [{ key: "bestTimeOfDay", value: "early morning" }, { key: "indoorOutdoor", value: "both" }],
      pctPriority: "Increased",
      pctPriorityValidFrom: "2026-09-01",
      pctPriorityValidThrough: "2026-12-31",
    }),
  poi("poi-castle-cs", "Pražský hrad", "wf4", "u3", "2026-08-09T14:20:00",
    "Největší souvislý hradní komplex na světě a po více než tisíc let sídlo hlav českého státu. Projděte nádvořími, katedrálou svatého Víta, Starým královským palácem a Zlatou uličkou.",
    {
      summary: "Tisíc let české historie na jednom kopci nad městem.",
      address: address("Hradčany", "119 08"),
      primaryCategory: ["pc-castles"],
    },
    { groupId: "poi-castle", locale: "cs" }),
  poi("poi-charles-bridge", "Charles Bridge", "wf7", "u2", "2026-08-10T11:45:00",
    "A 14th-century stone bridge connecting the Old Town and Lesser Town, lined with 30 baroque statues. Cross it at sunrise for the best light and the fewest people.",
    {
      summary: "Prague's most famous bridge, best crossed at sunrise.",
      primaryImage: "m-poi-2",
      image: ["m-poi-2"],
      address: address("Karlův most", "110 00"),
      geo: { lat: "50.0865", lng: "14.4114" },
      administrativeArea: ["area-praha-1"],
      openingHoursSpecification: hours("00:00", "24:00"),
      estimatedVisitDuration: "30",
      goodToKnow: ["Free to cross at any time", "Very busy between 10:00 and 18:00"],
      accessibility: ["acc-step-free-access"],
      primaryCategory: ["pc-monuments"],
      keywords: ["kw-gotika"],
      touristType: ["tt-couples", "tt-solo-travellers"],
      editorialLabels: ["el-must-see"],
    }),
  poi("poi-national-museum", "National Museum", "wf7", "u4", "2026-08-08T16:05:00",
    "The neo-Renaissance flagship museum at the top of Wenceslas Square, with natural history, archaeology and a spectacular Pantheon hall.",
    {
      summary: "Natural history, archaeology and a grand Pantheon, above Wenceslas Square.",
      primaryImage: "m-poi-3",
      image: ["m-poi-3"],
      address: address("Václavské náměstí 68", "115 79"),
      geo: { lat: "50.0791", lng: "14.4313" },
      administrativeArea: ["area-praha-1"],
      openingHoursSpecification: hours("10:00", "18:00"),
      temporaryClosure: [{ from: "2026-11-02", to: "2026-11-06", note: "Exhibition changeover" }],
      estimatedVisitDuration: "120",
      goodToKnow: ["Cloakroom is free", "Temporary exhibitions need a separate ticket"],
      accessibility: ["acc-step-free-access", "acc-lift", "acc-accessible-toilet"],
      telephone: ["+420 224 497 111"],
      url: "https://www.nm.cz",
      primaryCategory: ["pc-museums"],
      keywords: ["kw-pro-deti"],
      amenityFeature: ["am-cloakroom", "am-gift-shop", "am-caf-on-site"],
      touristType: ["tt-families", "tt-culture-lovers"],
    }),
  poi("poi-petrin", "Petřín Lookout Tower", "wf6", "u1", "2026-08-07T10:30:00",
    "A 63.5 metre steel tower inspired by the Eiffel Tower, reached by funicular or a walk through the orchards of Petřín Hill. 299 steps lead to panoramic views over the whole city.",
    {
      summary: "Prague's mini Eiffel Tower, with the best panorama in the city.",
      primaryImage: "m-poi-4",
      image: ["m-poi-4"],
      address: address("Petřínské sady 633", "118 00"),
      geo: { lat: "50.0833", lng: "14.3953" },
      administrativeArea: ["area-praha-1"],
      openingHoursSpecification: hours("10:00", "22:00"),
      seasonalClosure: [{ from: "2027-01-10", to: "2027-01-24", note: "Annual maintenance" }],
      estimatedVisitDuration: "60",
      goodToKnow: ["299 steps, no lift", "The funicular runs every 10–15 minutes"],
      primaryCategory: ["pc-viewpoints"],
      additionalCategories: ["pc-parks"],
      keywords: ["kw-pro-deti"],
      touristType: ["tt-active-travellers", "tt-couples"],
      editorialLabels: ["el-local-favourite"],
    }),
  poi("poi-cafe-louvre", "Café Louvre", "wf7", "u3", "2026-08-06T09:00:00",
    "A grand first-republic café on Národní třída, once frequented by Einstein and Kafka. Famous for its breakfast, billiard hall and high ceilings.",
    {
      summary: "A first-republic café where Kafka and Einstein once sat.",
      address: address("Národní 22", "110 00"),
      geo: { lat: "50.0814", lng: "14.4190" },
      administrativeArea: ["area-praha-1"],
      openingHoursSpecification: { ...hours("08:00", "23:30"), sat: { open: "09:00", close: "23:30" }, sun: { open: "09:00", close: "23:30" } },
      estimatedVisitDuration: "60",
      telephone: ["+420 224 930 949"],
      url: "https://www.cafelouvre.example",
      primaryCategory: ["pc-cafes"],
      amenityFeature: ["am-wi-fi", "am-toilets"],
      touristType: ["tt-foodies", "tt-couples"],
      editorialLabels: ["el-local-favourite"],
    }),
  poi("poi-letna", "Letná Park", "wf3", "u2", "2026-08-05T15:15:00",
    "A wide hilltop park with a beer garden, a giant metronome and one of the best views of the Vltava bridges. Popular with locals for picnics and skating.",
    {
      summary: "Hilltop park, beer garden and the best view of the river bridges.",
      primaryImage: "m-poi-5",
      image: ["m-poi-5"],
      address: address("Letenské sady", "170 00"),
      geo: { lat: "50.0963", lng: "14.4228" },
      administrativeArea: ["area-praha-7"],
      openingHoursSpecification: hours("00:00", "24:00"),
      estimatedVisitDuration: "90",
      goodToKnow: ["Free entry", "Beer garden is open from April to October"],
      primaryCategory: ["pc-parks"],
      keywords: ["kw-pro-deti"],
      touristType: ["tt-solo-travellers", "tt-active-travellers"],
      editorialLabels: ["el-hidden-gem"],
    }),
  poi("poi-rudolfinum", "Rudolfinum", "wf2", "u4", "2026-08-03T13:40:00",
    "A neo-Renaissance concert hall on the river, home of the Czech Philharmonic, with a gallery of contemporary art.",
    {
      summary: "Home of the Czech Philharmonic, on the Vltava embankment.",
      primaryImage: "m-poi-6",
      address: address("Alšovo nábřeží 12", "110 00"),
      geo: { lat: "50.0902", lng: "14.4137" },
      administrativeArea: ["area-praha-1"],
      openingHoursSpecification: hours("10:00", "18:00", ["mon"]),
      openingHoursNote: "Concert evenings run later.",
      primaryCategory: ["pc-culture"],
      additionalCategories: ["pc-museums"],
      touristType: ["tt-culture-lovers"],
    }),
  poi("poi-visitor-centre", "Prague Visitor Centre — Old Town Hall", "wf1", "u1", "2026-08-02T08:50:00",
    "",
    {
      address: address("Staroměstské náměstí 1", "110 00"),
      primaryCategory: ["pc-visitor"],
    }),
];

POI_TYPE.entryCount = POI_ENTRIES.length;
