// The look of the app is a per-browser preference (not part of the shared
// workspace): `cms.ui.*` keys are never synced. "golden" is the default. "wireframe" is
// simply the base CSS; "golden" is a layer of
// overrides keyed on <html data-theme="…"> (see index.css). index.html applies the saved
// choice before first paint so there is no flash of the other theme.
export const THEMES = [
  { id: "wireframe", name: "Wireframe", description: "Greys and light outlines, flat and neutral." },
  { id: "golden", name: "Golden", description: "Golden accents on warm paper, deeper shadows." },
];

const KEY = "cms.ui.theme";
export const DEFAULT_THEME = "golden"; // also set in index.html

export function getTheme() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (THEMES.some((t) => t.id === saved)) return saved;
  } catch { /* unreadable: use the default */ }
  return DEFAULT_THEME;
}

export function setTheme(id) {
  document.documentElement.dataset.theme = id;
  try { localStorage.setItem(KEY, JSON.stringify(id)); } catch { /* storage unavailable: applies for this visit only */ }
}
