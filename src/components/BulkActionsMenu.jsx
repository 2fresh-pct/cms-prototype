import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useI18n } from "../lib/i18n";
import Modal from "./Modal";

// An "Actions" dropdown for table selections. It is disabled until at least one
// row is selected. `actions` is a list of
//   { label, icon, onSelect, danger?, disabled?, hint?, confirm?: { title, message, confirmLabel } }
// or { heading } to start a labelled group. An action with `confirm` asks first.
export default function BulkActionsMenu({ count, actions }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => { if (count === 0) setOpen(false); }, [count]);

  function choose(action) {
    setOpen(false);
    if (action.confirm) setPending(action);
    else action.onSelect();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={count === 0}
        onClick={() => setOpen((v) => !v)}
        title={count === 0 ? t("Select rows to enable actions") : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white h-9 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-white"
      >
        {t("Actions")}
        {count > 0 && <span className="rounded-full bg-gray-200 px-1.5 text-xs text-gray-700">{count}</span>}
        <ChevronDown size={13} />
      </button>

      {open && (
        <div role="menu" className="absolute left-0 top-full z-30 mt-1 w-56 rounded-md border border-gray-300 bg-white py-1 shadow-lg">
          {actions.map((a, i) =>
            a.heading ? (
              <p key={`h${i}`} className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-gray-400">{t(a.heading)}</p>
            ) : (
              <button
                key={a.label}
                role="menuitem"
                disabled={a.disabled}
                onClick={() => choose(a)}
                title={a.disabled && a.hint ? t(a.hint) : undefined}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:text-gray-300 ${
                  a.danger ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-100"
                } disabled:hover:bg-transparent`}
              >
                {a.icon && <a.icon size={14} />}
                {a.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.color }} />}
                <span className="flex-1">{a.noTranslate ? a.label : t(a.label)}</span>
              </button>
            )
          )}
        </div>
      )}

      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending && t(pending.confirm.title)}
        footer={
          <>
            <button onClick={() => setPending(null)} className="rounded-md h-9 px-3 text-sm text-gray-500 hover:bg-gray-100">
              {t("Cancel")}
            </button>
            <button
              onClick={() => { const a = pending; setPending(null); a.onSelect(); }}
              className={`rounded-md h-9 px-3 text-sm font-medium text-white ${pending?.danger ? "bg-red-600 hover:bg-red-700" : "bg-gray-700 hover:bg-gray-800"}`}
            >
              {pending && t(pending.confirm.confirmLabel ?? "Confirm")}
            </button>
          </>
        }
      >
        {pending && t(pending.confirm.message, { n: count })}
      </Modal>
    </div>
  );
}
