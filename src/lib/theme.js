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

// Dark mode is a second, independent choice: <html data-mode="dark"> (see the dark
// layer at the end of index.css). It is off until someone turns it on, and
// index.html applies the saved choice before first paint.
const MODE_KEY = "cms.ui.mode";
const modeListeners = new Set();

export function getMode() {
  try { return JSON.parse(localStorage.getItem(MODE_KEY)) === "dark" ? "dark" : "light"; } catch { return "light"; }
}

export function setMode(mode) {
  if (mode === "dark") document.documentElement.dataset.mode = "dark";
  else delete document.documentElement.dataset.mode;
  try { localStorage.setItem(MODE_KEY, JSON.stringify(mode === "dark" ? "dark" : "light")); } catch { /* applies for this visit only */ }
  modeListeners.forEach((l) => l());
}

export function subscribeMode(callback) {
  modeListeners.add(callback);
  window.addEventListener("storage", callback); // another tab changed it
  return () => { modeListeners.delete(callback); window.removeEventListener("storage", callback); };
}

export function setTheme(id) {
  document.documentElement.dataset.theme = id;
  try { localStorage.setItem(KEY, JSON.stringify(id)); } catch { /* storage unavailable: applies for this visit only */ }
}
