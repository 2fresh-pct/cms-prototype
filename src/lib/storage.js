import { useState, useEffect, useCallback, useRef } from "react";
import { markDirty } from "./sync";

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore corrupt storage */
    }
    const initial = typeof initialValue === "function" ? initialValue() : initialValue;
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  });

  // Only a real change counts as an edit to sync; the first run just writes back
  // what was read (or seeded).
  const written = useRef(JSON.stringify(value));
  useEffect(() => {
    const next = JSON.stringify(value);
    localStorage.setItem(key, next);
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
