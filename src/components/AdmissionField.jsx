import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "../lib/i18n";
import Draft from "./Draft";
import { ADMISSION_TYPES, TICKET_TYPES, blankPrice, normalizeAdmission } from "../lib/admission";

const FIELD = "h-9 w-full rounded-md border border-gray-300 bg-[#fff] px-3 text-sm focus:border-violet-400 focus:outline-none";
const LABEL = "mb-1.5 block text-xs font-medium text-gray-900";

const TYPE_LABELS = {
  free: "Free",
  paid: "Paid",
  link: "Tickets link only",
  note: "Note only",
  unknown: "Unknown",
};
const TYPE_HINTS = {
  free: "The app shows “free”. Choose this only when you know that admission is free.",
  paid: "Prices by ticket type, in CZK.",
  link: "Tickets are sold by someone else: give the seller and the link. No price is shown.",
  note: "A sentence is shown instead of a price, for example “Part of the Prague Castle circuit admission”.",
  unknown: "Nothing about admission is shown.",
};

// Admission: first say what kind it is, then fill in only what that kind needs.
export default function AdmissionField({ value, onChange }) {
  const { t } = useI18n();
  const listId = useId();
  return (
    <Draft value={normalizeAdmission(value)} onCommit={onChange}>
      {(a, setA, commit) => {
        const save = (next, now) => {
          setA(next);
          if (now) commit(next);
        };
        const patch = (p, now = false) => save({ ...a, ...p }, now);
        const setPrice = (i, p, now = false) => patch({ prices: a.prices.map((x, k) => (k === i ? { ...x, ...p } : x)) }, now);

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Admission type")}>
              {ADMISSION_TYPES.map((type) => {
                const on = a.type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={on}
                    onClick={() => patch({ type }, true)}
                    className={`h-8 rounded-full border px-3.5 text-sm ${on ? "border-gray-800 bg-gray-800 text-white" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"}`}
                  >
                    {t(TYPE_LABELS[type])}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-gray-500">{t(TYPE_HINTS[a.type])}</p>

            {a.type === "paid" && (
              <div className="space-y-3">
                <datalist id={listId}>{TICKET_TYPES.map((ticket) => <option key={ticket} value={t(ticket)} />)}</datalist>
                {a.prices.map((p, i) => (
                  <div key={i} className="rounded-md border border-gray-300 bg-[#fff] p-3">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                      <div>
                        <label className={LABEL}>{t("Ticket type")}</label>
                        <input list={listId} value={p.ticket} onChange={(e) => setPrice(i, { ticket: e.target.value })} className={FIELD} />
                      </div>
                      <div>
                        <label className={LABEL}>{t("Price")} ({t("CZK")})</label>
                        <input type="number" min={0} step={1} value={p.price} onChange={(e) => setPrice(i, { price: e.target.value })} className={FIELD} />
                      </div>
                      <div>
                        <label className={LABEL}>{t("Valid from")}</label>
                        <input type="date" value={p.from} onChange={(e) => setPrice(i, { from: e.target.value })} className={FIELD} />
                      </div>
                      <div>
                        <label className={LABEL}>{t("Valid until")}</label>
                        <input type="date" value={p.to} onChange={(e) => setPrice(i, { to: e.target.value })} className={FIELD} />
                      </div>
                      <div className="col-span-2 flex items-end gap-2">
                        <div className="min-w-0 flex-1">
                          <label className={LABEL}>{t("Note")}</label>
                          <input value={p.note} onChange={(e) => setPrice(i, { note: e.target.value })} className={FIELD} />
                        </div>
                        <button
                          type="button"
                          onClick={() => patch({ prices: a.prices.filter((_, k) => k !== i) }, true)}
                          aria-label={t("Remove price")}
                          title={t("Remove price")}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => patch({ prices: [...a.prices, blankPrice()] }, true)} className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700">
                  <Plus size={13} /> {t("Add price")}
                </button>
              </div>
            )}

            {a.type === "link" && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                <div>
                  <label className={LABEL}>{t("Seller")}</label>
                  <input value={a.seller} onChange={(e) => patch({ seller: e.target.value })} className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>{t("Ticket link")}</label>
                  <input type="url" value={a.url} onChange={(e) => patch({ url: e.target.value })} placeholder="https://" className={FIELD} />
                </div>
              </div>
            )}

            {a.type === "free" && (
              <div>
                <label className={LABEL}>{t("Registration link (optional)")}</label>
                <input type="url" value={a.url} onChange={(e) => patch({ url: e.target.value })} placeholder="https://" className={FIELD} />
              </div>
            )}

            {a.type !== "unknown" && (
              <div>
                <label className={LABEL}>{a.type === "note" ? t("Text shown instead of a price") : t("Note")}</label>
                <input value={a.note} onChange={(e) => patch({ note: e.target.value })} className={FIELD} />
              </div>
            )}
          </div>
        );
      }}
    </Draft>
  );
}
