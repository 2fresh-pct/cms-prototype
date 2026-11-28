// Admission, the way editors describe it. The value of an Admission field is
//   { type, prices, url, note }
// where `type` says which of these it is, so the rest cannot contradict it:
//   "free"    admission is free (said outright, never assumed from an empty field)
//   "paid"    a list of prices (ticket type, price in CZK, note)
//   "link"    tickets are sold elsewhere: a link, no price
//   "note"    a sentence instead of a price ("Part of the Prague Castle circuit")
//   "unknown" nothing is shown about admission (except a note, if there is one)
export const ADMISSION_TYPES = ["paid", "free", "link", "note", "unknown"];

// Ticket types to choose from; any other text can be typed.
export const TICKET_TYPES = ["Adult", "Reduced fare", "Student", "Child", "Senior", "Family", "Group ticket", "Disabled (ZTP)"];

export const blankPrice = () => ({ ticket: "", price: "", note: "" });

// Paid admission starts with these two prices to fill in (ticket types, translated by `tr`).
export const defaultPrices = (tr) => [{ ...blankPrice(), ticket: tr("Adult") }, { ...blankPrice(), ticket: tr("Reduced fare") }];

export function normalizeAdmission(v) {
  return {
    type: ADMISSION_TYPES.includes(v?.type) ? v.type : "unknown",
    prices: Array.isArray(v?.prices) ? v.prices.map((p) => ({ ticket: p.ticket ?? "", price: p.price ?? "", note: p.note ?? "" })) : [],
    url: v?.url ?? "",
    note: v?.note ?? "",
  };
}

// One line for the version history.
export function summarizeAdmission(value, tr) {
  const a = normalizeAdmission(value);
  switch (a.type) {
    case "free": return [tr("Free"), a.note].filter(Boolean).join(" · ");
    case "paid": {
      const prices = a.prices.filter((p) => p.price !== "").map((p) => `${p.ticket ? `${tr(p.ticket)} ` : ""}${p.price} ${tr("CZK")}`);
      return [prices.join(", ") || tr("Paid"), a.note].filter(Boolean).join(" · ");
    }
    case "link": return [tr("Tickets"), a.url].filter(Boolean).join(" · ");
    case "note": return a.note || "—";
    default: return a.note || "—";
  }
}
