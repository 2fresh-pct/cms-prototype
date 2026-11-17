import { useState, useEffect, useCallback, useRef } from "react";
import { markDirty } from "./sync";
import { capEntriesHistory } from "./history";

// The browser keeps about 5 MB per site. When a save does not fit, the app must not
// crash: older versions in the history are dropped to make room (the history is the
// bulk of it), and if it still does not fit the change stays on screen only and a
// banner says so (see SyncBanner).
let full = false;
const listeners = new Set();
export const isStorageFull = () => full;
export function subscribeStorageFull(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function setFull(v) { if (full !== v) { full = v; listeners.forEach((fn) => fn(v)); } }

export function safeSetItem(key, text) {
  try {
    localStorage.setItem(key, text);
    setFull(false);
    return true;
  } catch {
    if (key === "cms.entries") {
      for (const keep of [20, 5, 1]) {
        try {
          localStorage.setItem(key, JSON.stringify(capEntriesHistory(JSON.parse(text), keep)));
          setFull(false);
          return true;
        } catch { /* try a shorter history */ }
      }
    }
    setFull(true);
    return false;
  }
}

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore corrupt storage */
    }
    const initial = typeof initialValue === "function" ? initialValue() : initialValue;
    safeSetItem(key, JSON.stringify(initial));
    return initial;
  });

  // Only a real change counts as an edit to sync; the first run just writes back
  // what was read (or seeded).
  const written = useRef(JSON.stringify(value));
  useEffect(() => {
    const next = JSON.stringify(value);
    safeSetItem(key, next);
    if (next !== written.current) {
      written.current = next;
      markDirty();
    }
  }, [key, value]);

  const reset = useCallback(() => {
    const initial = typeof initialValue === "function" ? initialValue() : initialValue;
    setValue(initial);
  }, [initialValue]);

  return [value, setValue, reset];
}
