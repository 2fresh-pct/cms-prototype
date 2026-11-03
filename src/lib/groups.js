// Groups are named tabs that a content type's fields are put under (`field.group`
// holds the group's name; a field without one is in "General"). A type's
// `groups` array fixes the tab order and lets a group exist before it holds
// fields; types saved before that existed just list the groups their fields use.
export const GENERAL = "__general";

export function groupsOf(type) {
  const listed = type?.groups ?? [];
  const used = [];
  for (const f of type?.fields ?? []) if (f.group && !used.includes(f.group)) used.push(f.group);
  return [...listed, ...used.filter((g) => !listed.includes(g))];
}

// The tabs an entry page shows for `fields` (the fields outside the fixed
// title / slug / body slots): General first (if any field is ungrouped), then
// each group that has fields, in the type's order.
export function sectionsOf(type, fields) {
  const order = groupsOf(type);
  const sections = [];
  const general = fields.filter((f) => !f.group || !order.includes(f.group));
  if (general.length) sections.push({ name: null, fields: general });
  for (const name of order) {
    const inGroup = fields.filter((f) => f.group === name);
    if (inGroup.length) sections.push({ name, fields: inGroup });
  }
  return sections;
}
