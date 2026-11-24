// A Media field holds an ordered list of files unless it is set to `multiple:
// false`, in which case it holds a single id. "Media list" is the older
// spelling of a Media field that allows several; it is kept so saved content
// types keep working.
export const holdsSeveral = (field) => field.type === "Media list" || (field.type === "Media" && field.multiple !== false);

// Tolerates a field being switched between one and several files after it has
// values: a single id and a list of ids are both read as a list.
export const mediaIds = (value) => (Array.isArray(value) ? value : value ? [value] : []);

export const isVideo = (item) => Boolean(item?.kind?.startsWith("video/"));

// 83 -> "1:23", 3725 -> "1:02:05"
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
