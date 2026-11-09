import { useState } from "react";
import { GripVertical, Link2, X } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { normalizeEntryStatus } from "../lib/seed";
import { typeIcon } from "../lib/typeIcons";
import Modal from "./Modal";
import StatusPill from "./StatusPill";

// Which content types a Reference field may link to. `targetTypeIds` (set in the
// content type editor) wins; the older `targetName` / `targetTypeId` pointed at
// a single type; with neither, any type can be linked.
export function allowedTypeIds(field, contentTypes) {
  if (field.targetTypeIds?.length) return field.targetTypeIds.filter((id) => contentTypes.some((ct) => ct.id === id));
  const legacy = field.targetName || field.targetTypeId;
  if (legacy) return contentTypes.filter((ct) => ct.name === legacy || ct.id === legacy).map((ct) => ct.id);
  return contentTypes.map((ct) => ct.id);
}

// One linked item: icon, title, and enough context (type, language, status) to
// tell similar items apart.
function EntryLine({ entry, ctx }) {
  const { t } = useI18n();
  const type = ctx.contentTypes.find((ct) => ct.id === entry.contentTypeId);
  const Icon = typeIcon(type?.icon);
  const step = ctx.workflowSteps?.find((s) => s.id === normalizeEntryStatus(entry.status, ctx.workflowSteps));
  return (
    <>
      <Icon size={15} className="shrink-0 text-gray-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900" title={entry.title}>{entry.title}</p>
        <p className="truncate text-xs text-gray-400">
          {type ? t(type.name) : ""}{entry.locale ? ` · ${entry.locale.toUpperCase()}` : ""}
        </p>
      </div>
      <StatusPill status={step?.name ?? entry.status} color={step?.color} />
    </>
  );
}

function Picker({ open, onClose, candidates, types, selected, onConfirm, ctx }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(selected);
  const [search, setSearch] = useState("");
  const [typeId, setTypeId] = useState("");

  // A fresh draft each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) { setWasOpen(true); setDraft(selected); setSearch(""); setTypeId(""); }
  if (!open && wasOpen) setWasOpen(false);

  const shown = candidates.filter(
    (e) => (!typeId || e.contentTypeId === typeId) && (!search || e.title.toLowerCase().includes(search.toLowerCase())),
  );
  const toggle = (id) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-2xl"
      title={t("Link content items")}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md h-9 px-3 text-sm text-gray-500 hover:bg-gray-100">{t("Cancel")}</button>
          <button type="button" onClick={() => onConfirm(draft)} className="rounded-md bg-gray-700 h-9 px-3 text-sm font-medium text-white hover:bg-gray-800">
            {t("Use {n} selected", { n: draft.length })}
          </button>
        </>
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Search content…")}
          className="w-full rounded-md border border-gray-300 bg-[#fff] h-9 px-3 text-sm focus:border-violet-400 focus:outline-none"
        />
        {types.length > 1 && (
          <select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            aria-label={t("Content type")}
            className="shrink-0 rounded-md border border-gray-300 bg-[#fff] h-9 px-3 text-sm"
          >
            <option value="">{t("All types")}</option>
            {types.map((ct) => <option key={ct.id} value={ct.id}>{t(ct.name)}</option>)}
          </select>
        )}
      </div>
      <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
        {shown.map((e) => {
          const index = draft.indexOf(e.id);
          const isSelected = index !== -1;
          return (
            <button
              key={e.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(e.id)}
              className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left ${
                isSelected ? "border-gray-800 ring-1 ring-gray-800" : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <span
                className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-xs font-medium ${
                  isSelected ? "bg-gray-800 text-white" : "border border-gray-300"
                }`}
              >
                {isSelected ? index + 1 : null}
              </span>
              <EntryLine entry={e} ctx={ctx} />
            </button>
          );
        })}
        {shown.length === 0 && <p className="py-10 text-center text-sm text-gray-400">{t("No items to show.")}</p>}
      </div>
    </Modal>
  );
}

// Links content items to an entry (value: ordered list of entry ids), e.g.
// "related articles". Items are chosen in a dialog and dragged into order.
export default function EntryReferenceField({ field, value, onChange, ctx }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const ids = Array.isArray(value) ? value : [];
  const byId = Object.fromEntries(ctx.entries.map((e) => [e.id, e]));

  const typeIds = allowedTypeIds(field, ctx.contentTypes);
  const types = ctx.contentTypes.filter((ct) => typeIds.includes(ct.id));
  const candidates = ctx.entries
    .filter((e) => typeIds.includes(e.contentTypeId) && e.id !== ctx.entryId)
    .sort((a, b) => a.title.localeCompare(b.title));

  // Dropping a card onto another moves it to that position.
  function drop(targetId) {
    if (dragId && dragId !== targetId) {
      const next = ids.filter((x) => x !== dragId);
      next.splice(next.indexOf(targetId) + (ids.indexOf(dragId) < ids.indexOf(targetId) ? 1 : 0), 0, dragId);
      onChange(next);
    }
    setDragId(null);
    setOverId(null);
  }

  const addButton = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      disabled={candidates.length === 0}
      className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white h-9 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      <Link2 size={14} /> {t(ids.length === 0 ? "Add content items" : "Add or remove items")}
    </button>
  );

  return (
    <div className="space-y-2">
      {ids.length === 0 ? (
        <div className="flex items-center gap-3 rounded-md border border-dashed border-gray-300 px-3 py-3">
          {addButton}
          <span className="text-sm text-gray-400">
            {candidates.length === 0 ? t("No content items to link to yet.") : t("No content items linked")}
          </span>
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {ids.map((id) => {
              const entry = byId[id];
              return (
                <li
                  key={id}
                  onDragOver={(e) => { if (dragId) { e.preventDefault(); if (overId !== id) setOverId(id); } }}
                  onDrop={(e) => { e.preventDefault(); drop(id); }}
                  className={`flex items-center gap-2 rounded-md border bg-white p-2 ${dragId === id ? "opacity-40" : ""} ${
                    overId === id && dragId && dragId !== id ? "border-gray-800 ring-2 ring-gray-800" : "border-gray-300"
                  }`}
                >
                  <span
                    draggable
                    title={t("Drag to reorder")}
                    aria-label={t("Drag to reorder")}
                    onDragStart={(e) => {
                      setDragId(id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setDragImage(e.currentTarget.closest("li"), 12, 12);
                    }}
                    onDragEnd={() => { setDragId(null); setOverId(null); }}
                    className="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
                  >
                    <GripVertical size={15} />
                  </span>
                  {entry ? <EntryLine entry={entry} ctx={ctx} /> : <span className="min-w-0 flex-1 truncate text-sm italic text-gray-400">{t("Missing item")}</span>}
                  <button
                    type="button"
                    onClick={() => onChange(ids.filter((x) => x !== id))}
                    aria-label={t("Remove")}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-3">
            {addButton}
            {ids.length > 1 && <span className="text-xs text-gray-400">{t("Drag to reorder")}</span>}
          </div>
        </>
      )}
      <Picker
        open={open}
        onClose={() => setOpen(false)}
        candidates={candidates}
        types={types}
        selected={ids.filter((id) => byId[id])}
        onConfirm={(next) => { setOpen(false); onChange(next); }}
        ctx={ctx}
      />
    </div>
  );
}
