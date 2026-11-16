import { useSyncExternalStore } from "react";

// What this browser is allowed to do, as a mock of roles. There is one switch,
// the editor test mode (Settings > Users & roles): on, the prototype behaves as
// it would for the Editor role, which sees Content and Media and nothing that
// models content (content types, taxonomies), and finds Settings read-only.
//
// It is kept in this browser only (`cms.ui.` keys are not part of the shared
// workspace), so turning it on changes nothing for anyone else.
const KEY = "cms.ui.editorMode";
const listeners = new Set();

const read = () => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};

export function setEditorMode(on) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch { /* storage unavailable: the mode just stays as it was */ }
  listeners.forEach((l) => l());
}

const subscribe = (callback) => {
  listeners.add(callback);
  window.addEventListener("storage", callback); // another tab changed it
  return () => { listeners.delete(callback); window.removeEventListener("storage", callback); };
};

export function useAccess() {
  const editorMode = useSyncExternalStore(subscribe, read, () => false);
  return {
    editorMode,
    setEditorMode,
    role: editorMode ? "Editor" : "Admin",
    canModel: !editorMode, // content types and taxonomies
    canEditSettings: !editorMode,
  };
}
