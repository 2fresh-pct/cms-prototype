// Every saved change of an item keeps a full snapshot in its version history, and
// the history lives in the same browser storage (about 5 MB in all) as everything
// else. An item that is edited a lot would fill it on its own, so only the newest
// versions are kept.
export const MAX_HISTORY = 40;

export const capHistory = (history, max = MAX_HISTORY) =>
  Array.isArray(history) && history.length > max ? history.slice(-max) : history;

// The entries with every history cut to the newest `max` versions.
export const capEntriesHistory = (entries, max = MAX_HISTORY) =>
  entries.map((e) => (Array.isArray(e.history) && e.history.length > max ? { ...e, history: capHistory(e.history, max) } : e));
