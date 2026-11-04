// Keeps this browser's workspace (every `cms.*` localStorage key) in step with
// the shared copy behind /api/workspace, so the same content shows everywhere.
//
// localStorage stays the working copy: pages read and write it exactly as
// before. This module loads the shared copy at startup, pushes local changes a
// moment after they happen, and shows two notices:
//   stale     the shared copy has newer changes than this browser
//   error     the last save didn't reach the server (retried on the next change)
// The browser being edited always wins: a save overwrites the shared copy
// without asking. A browser that was never edited just takes the shared copy.
// With no store connected (or no API, as on a plain static host) it stays off.

import { seedEntries, seedContentTypes } from "./seed";

const API = "/api/workspace";
const K_ETAG = "cms.sync.etag"; // version of the shared copy this browser last saw
const K_DIRTY = "cms.sync.dirty"; // local changes not yet saved to the shared copy
const K_EDITED = "cms.sync.editedAt"; // when this browser last had a local edit
const K_BACKUP = "cms.sync.backup"; // this browser's own content, kept when the shared copy replaced it
const PUSH_DELAY_MS = 800;
const CHECK_EVERY_MS = 30_000;

// Per-browser state that is not part of the workspace.
export const isSharedKey = (k) => k.startsWith("cms.") && !k.startsWith("cms.sync.") && !k.startsWith("cms.ui.");
export const sharedKeys = () => Object.keys(localStorage).filter(isSharedKey);

let enabled = false;
let state = { status: "off", detail: "" };
let timer = null;
let saving = false;
let dirtySeq = 0;
const listeners = new Set();

function setState(status, detail = "") {
  state = { status, detail };
  listeners.forEach((fn) => fn(state));
}

export const getSyncState = () => state;
export const isSyncEnabled = () => enabled;
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function snapshot() {
  const data = {};
  for (const k of sharedKeys()) {
    try { data[k] = JSON.parse(localStorage.getItem(k)); } catch { /* skip an unreadable value */ }
  }
  return data;
}

// "Sample data": the built-in demo content a browser starts with (see seed.js),
// before anyone created or changed anything. It is never worth uploading, and a
// shared copy that is only sample data counts as empty.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isSample = (entries, types) =>
  (entries == null || same(entries, seedEntries())) && (types == null || same(types, seedContentTypes()));
const readLocal = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const localHasRealContent = () =>
  Boolean(Date.parse(localStorage.getItem(K_EDITED) ?? "")) || !isSample(readLocal("cms.entries"), readLocal("cms.contentTypes"));

// Replaces the workspace in this browser with the shared copy. Content this
// browser had that the shared copy doesn't is kept as a backup first (Settings >
// Data can restore it), so taking the shared copy never silently destroys work.
function adopt(data, etag) {
  if (localHasRealContent() && !same(snapshot(), data)) {
    try { localStorage.setItem(K_BACKUP, JSON.stringify({ savedAt: new Date().toISOString(), data: snapshot() })); } catch { /* storage full: no backup */ }
  }
  for (const k of sharedKeys()) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(data)) if (isSharedKey(k)) localStorage.setItem(k, JSON.stringify(v));
  localStorage.setItem(K_ETAG, etag);
  localStorage.removeItem(K_DIRTY);
}

const isJson = (res) => res.headers.get("content-type")?.includes("application/json");

// Runs before the app renders. Never throws: any failure leaves sync off.
export async function initSync() {
  try {
    const res = await fetch(API, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    const localEtag = localStorage.getItem(K_ETAG);
    const dirty = Boolean(localStorage.getItem(K_DIRTY));
    const hasLocal = sharedKeys().length > 0;

    if (res.status === 204) {
      enabled = true;
      setState("idle");
      // Only real content is uploaded; a browser showing sample data leaves the store empty.
      if (hasLocal && localHasRealContent()) { dirtySeq += 1; localStorage.setItem(K_DIRTY, "1"); await pushNow(); }
      startChecking();
      return;
    }
    if (res.status !== 200 || !isJson(res)) return;

    const { etag, data, savedAt } = await res.json();
    enabled = true;
    setState("idle");
    startChecking();
    const editedAt = Date.parse(localStorage.getItem(K_EDITED) ?? "") || 0;
    if (localEtag === etag) {
      if (dirty) schedulePush();
    } else if (dirty) {
      // Edits this browser hasn't saved yet are the ones being worked on: keep them.
      await pushNow();
    } else if (!localEtag && hasLocal && localHasRealContent() && isSample(data["cms.entries"], data["cms.contentTypes"])) {
      // The shared copy is only sample data and this browser has real content: real wins.
      dirtySeq += 1;
      localStorage.setItem(K_DIRTY, "1");
      await pushNow();
    } else if (!localEtag && hasLocal && editedAt > (Date.parse(savedAt ?? "") || 0)) {
      // Never connected, but edited here more recently than the shared copy was saved.
      dirtySeq += 1;
      localStorage.setItem(K_DIRTY, "1");
      await pushNow();
    } else {
      adopt(data, etag);
    }
  } catch {
    enabled = false;
  }
}

function schedulePush() {
  clearTimeout(timer);
  timer = setTimeout(() => pushNow(), PUSH_DELAY_MS);
}

// Called whenever a workspace value changes.
export function markDirty() {
  localStorage.setItem(K_EDITED, new Date().toISOString());
  if (!enabled) return;
  dirtySeq += 1;
  localStorage.setItem(K_DIRTY, "1");
  schedulePush();
}

export async function pushNow() {
  if (!enabled) return;
  clearTimeout(timer);
  if (saving) { schedulePush(); return; }
  saving = true;
  const seq = dirtySeq;
  setState("saving");
  try {
    const res = await fetch(API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // force: whoever is saving now wins; the server never refuses on a version mismatch.
      body: JSON.stringify({ baseEtag: localStorage.getItem(K_ETAG), force: true, data: snapshot() }),
    });
    if (res.status === 413) { setState("error", "too-large"); return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { etag } = await res.json();
    localStorage.setItem(K_ETAG, etag);
    if (seq === dirtySeq) localStorage.removeItem(K_DIRTY);
    else schedulePush(); // changed again while saving
    setState("idle");
  } catch {
    setState("error", "network");
  } finally {
    saving = false;
  }
}

// Discards this browser's workspace in favour of the shared copy.
export async function loadShared() {
  const res = await fetch(API, { cache: "no-store" });
  if (res.status === 200 && isJson(res)) {
    const { etag, data } = await res.json();
    adopt(data, etag);
  } else if (res.status === 204) {
    localStorage.removeItem(K_DIRTY);
  } else {
    throw new Error(`HTTP ${res.status}`);
  }
  window.location.reload();
}

// The content this browser had before the shared copy replaced it, if any.
export function getBackup() {
  const b = readLocal(K_BACKUP);
  return b?.data ? { savedAt: b.savedAt, entries: b.data["cms.entries"]?.length ?? 0 } : null;
}

// Puts that content back in this browser (and, if connected, over the shared copy).
export async function restoreBackup() {
  const b = readLocal(K_BACKUP);
  if (!b?.data) return;
  for (const k of sharedKeys()) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(b.data)) if (isSharedKey(k)) localStorage.setItem(k, JSON.stringify(v));
  localStorage.removeItem(K_BACKUP);
  localStorage.setItem(K_EDITED, new Date().toISOString());
  if (enabled) { dirtySeq += 1; localStorage.setItem(K_DIRTY, "1"); await pushNow(); }
  window.location.reload();
}

// Makes this browser's workspace the shared copy for everyone.
export const overwriteShared = () => pushNow();

async function checkRemote() {
  if (!enabled || document.visibilityState !== "visible") return;
  if (state.status !== "idle" || localStorage.getItem(K_DIRTY)) return;
  try {
    const res = await fetch(`${API}?meta=1`, { cache: "no-store" });
    if (res.status !== 200) return;
    const { etag } = await res.json();
    if (etag !== localStorage.getItem(K_ETAG) && state.status === "idle") setState("stale");
  } catch { /* try again next time */ }
}

let checking = false;
function startChecking() {
  if (checking) return;
  checking = true;
  setInterval(checkRemote, CHECK_EVERY_MS);
  document.addEventListener("visibilitychange", checkRemote);
}
