// The colours a content type's icon can have. Every type gets a different one
// by default (see `nextTypeColor`), and editors can pick another in the type
// editor.
export const TYPE_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#0ea5e9", // sky
  "#0d9488", // teal
  "#f59e0b", // amber
  "#ec4899", // pink
  "#ef4444", // red
  "#65a30d", // lime
  "#4f46e5", // indigo
  "#ea580c", // orange
  "#c026d3", // fuchsia
  "#64748b", // slate
];

// The first palette colour that no type uses yet; once all are taken, the
// palette starts over.
export function nextTypeColor(usedColors) {
  const used = new Set([...usedColors].map((c) => String(c).toLowerCase()));
  return TYPE_COLORS.find((c) => !used.has(c)) ?? TYPE_COLORS[used.size % TYPE_COLORS.length];
}
