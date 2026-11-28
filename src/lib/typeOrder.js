// Content types are always listed alphabetically by the name shown in the UI.
export function sortTypes(types, t, lang = "cs") {
  return [...types].sort((a, b) => t(a.name).localeCompare(t(b.name), lang, { sensitivity: "base" }));
}
