// The API key of a field comes from its name, the way a slug comes from a title:
// "Opening hours note" -> openingHoursNote, "hlavní obrázek" -> hlavniObrazek.
// Accents are dropped (Czech names read fine without them) and anything that is
// not a letter or digit separates words.

// The key a name stands for, before it is made unique: "" when the name has no
// letters or digits to build one from.
export function keyBase(label) {
  const words = (label ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const base = words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join("");
  if (!base) return "";
  return /^[0-9]/.test(base) ? `field${base}` : base;
}

// The key for `label`, made unique among `used` (a Set of keys) with a number.
export function fieldKeyFor(label, used) {
  const base = keyBase(label) || "field";
  let key = base;
  for (let n = 2; used.has(key); n += 1) key = `${base}${n}`;
  return key;
}
