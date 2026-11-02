// Keeps this browser's workspace (every `cms.*` localStorage key) in step with
// the shared copy behind /api/workspace, so the same content shows everywhere.
//
// localStorage stays the working copy: pages read and write it exactly as
// before. This module loads the shared copy at startup, pushes local changes a
// moment after they happen, and flags the cases that need a decision:
//   conflict  this browser and the shared copy have each changed (or never met)
//   stale     the shared copy has newer changes than this browser
//   error     the last save didn't reach the server (retried on the next change)
// With no store connected (or no API, as on a plain static host) it stays off.

const API = "/api/workspace";
const K_ETAG = "cms.sync.etag"; // version of the shared copy this browser last saw
const K_DIRTY = "cms.sync.dirty"; // local changes not yet saved to the shared copy
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

// Replaces the workspace in this browser with the shared copy.
function adopt(data, etag) {
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
      if (hasLocal) { dirtySeq += 1; localStorage.setItem(K_DIRTY, "1"); await pushNow(); }
      startChecking();
      return;
    }
    if (res.status !== 200 || !isJson(res)) return;

    const { etag, data } = await res.json();
    enabled = true;
    setState("idle");
    startChecking();
    if (localEtag === etag) {
      if (dirty) schedulePush();
    } else if (dirty || (!localEtag && hasLocal)) {
      // Local changes the shared copy doesn't have, or a browser that has its own
      // content but has never been connected: don't overwrite either side silently.
      setState("conflict");
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
  if (!enabled) return;
  dirtySeq += 1;
  localStorage.setItem(K_DIRTY, "1");
  if (state.status === "conflict") return; // wait for the decision
  schedulePush();
}

export async function pushNow({ force = false } = {}) {
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
      body: JSON.stringify({ baseEtag: localStorage.getItem(K_ETAG), force, data: snapshot() }),
    });
    if (res.status === 409) { setState("conflict"); return; }
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

// Makes this browser's workspace the shared copy for everyone.
export const overwriteShared = () => pushNow({ force: true });

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
