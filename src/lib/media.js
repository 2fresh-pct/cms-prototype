// A Media field holds one file (an id) or, when it allows several, an ordered
// list of ids. "Media list" is the older spelling of a Media field that allows
// several; it is kept so saved content types keep working.
export const holdsSeveral = (field) => field.type === "Media list" || (field.type === "Media" && field.multiple === true);

// Tolerates a field being switched between one and several files after it has
// values: a single id and a list of ids are both read as a list.
export const mediaIds = (value) => (Array.isArray(value) ? value : value ? [value] : []);
