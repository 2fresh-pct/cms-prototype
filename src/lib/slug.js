// URL slugs: lowercase letters, digits and single hyphens. Accents are
// transliterated ("Pražský hrad" -> "prazsky-hrad") rather than dropped.
export function slugify(text) {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// An entry's slug follows its title until someone edits it; an edited slug is
// kept in `entry.slug`.
export const slugOf = (entry) => entry.slug || slugify(entry.title);
