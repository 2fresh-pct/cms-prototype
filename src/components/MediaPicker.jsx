import { useEffect, useRef, useState } from "react";
import { Check, GripVertical, ImagePlus, X } from "lucide-react";
import { useI18n } from "../lib/i18n";
import Modal from "./Modal";

const formatSize = (kb) => (kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

function Thumb({ item, size = 48 }) {
  return <div className="wf-image shrink-0 rounded border border-gray-300" style={{ width: size, height: size }} aria-hidden title={item?.name} />;
}

function Library({ open, onClose, media, selected, multiple, onConfirm }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(selected);
  const [search, setSearch] = useState("");

  // A fresh draft each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) { setWasOpen(true); setDraft(selected); setSearch(""); }
  if (!open && wasOpen) setWasOpen(false);

  // Bring the current choice into view when the dialog opens.
  const gridRef = useRef(null);
  useEffect(() => {
    if (open) gridRef.current?.querySelector("[aria-pressed=true]")?.scrollIntoView({ block: "nearest" });
  }, [open]);

  const shown = media.filter((m) => !search || m.name.toLowerCase().includes(search.toLowerCase()));

  function pick(id) {
    if (!multiple) return setDraft([id]);
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-3xl"
      title={t("Media library")}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100">{t("Cancel")}</button>
          <button
            type="button"
            disabled={!multiple && draft.length === 0}
            onClick={() => onConfirm(draft)}
            className="rounded-md bg-gray-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
          >
            {multiple ? t("Use {n} selected", { n: draft.length }) : t("Select")}
          </button>
        </>
      }
    >
      <input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("Search media…")}
        className="mb-3 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
      />
      <div ref={gridRef} className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
        {shown.map((m) => {
          const index = draft.indexOf(m.id);
          const isSelected = index !== -1;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => pick(m.id)}
              onDoubleClick={() => { if (!multiple) onConfirm([m.id]); }}
              className={`relative overflow-hidden rounded-lg border bg-white text-left ${isSelected ? "border-gray-800 ring-2 ring-gray-800" : "border-gray-300 hover:border-gray-400"}`}
            >
              <div className="wf-image aspect-square border-b border-gray-300" />
              <div className="p-2">
                <p className="truncate text-xs font-medium text-gray-900" title={m.name}>{m.name}</p>
                <p className="text-xs text-gray-400">{formatSize(m.sizeKb)}</p>
              </div>
              {isSelected && (
                <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-800 px-1 text-xs font-medium text-white">
                  {multiple ? index + 1 : <Check size={12} />}
                </span>
              )}
            </button>
          );
        })}
        {shown.length === 0 && <p className="col-span-full py-10 text-center text-sm text-gray-400">{t("No items to show.")}</p>}
      </div>
    </Modal>
  );
}

// Chooses one file (value: id) or an ordered list (value: ids) from the media
// library in a dialog.
export default function MediaPicker({ media, value, onChange, multiple = false }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const ids = multiple ? (value ?? []) : value ? [value] : [];
  const byId = Object.fromEntries(media.map((m) => [m.id, m]));

  function confirm(next) {
    setOpen(false);
    onChange(multiple ? next : next[0] ?? "");
  }

  // Dragging a tile onto another moves it to that position.
  function drop(targetId) {
    if (dragId && dragId !== targetId) {
      const next = ids.filter((x) => x !== dragId);
      next.splice(ids.indexOf(targetId), 0, dragId);
      onChange(next);
    }
    setDragId(null);
    setOverId(null);
  }

  const chooseButton = (label) => (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      <ImagePlus size={14} /> {t(label)}
    </button>
  );

  return (
    <div>
      {!multiple && (
        ids.length === 0 ? (
          <div className="flex items-center gap-3 rounded-md border border-dashed border-gray-300 px-3 py-3">
            {chooseButton("Choose from library")}
            <span className="text-sm text-gray-400">{t("No file chosen")}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-gray-300 p-2">
            <Thumb item={byId[ids[0]]} size={56} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{byId[ids[0]]?.name ?? t("Missing file")}</p>
              {byId[ids[0]] && <p className="text-xs text-gray-400">{byId[ids[0]].kind} · {formatSize(byId[ids[0]].sizeKb)}</p>}
            </div>
            {chooseButton("Change")}
            <button type="button" onClick={() => onChange("")} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600" aria-label={t("Remove")}>
              <X size={14} />
            </button>
          </div>
        )
      )}

      {multiple && (
        <div className="space-y-2">
          {ids.length === 0 ? (
            <div className="flex items-center gap-3 rounded-md border border-dashed border-gray-300 px-3 py-3">
              {chooseButton("Choose from library")}
              <span className="text-sm text-gray-400">{t("No files chosen")}</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {ids.map((id) => (
                <div
                  key={id}
                  draggable
                  onDragStart={(e) => { setDragId(id); e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(e) => { e.preventDefault(); if (dragId && overId !== id) setOverId(id); }}
                  onDrop={(e) => { e.preventDefault(); drop(id); }}
                  onDragEnd={() => { setDragId(null); setOverId(null); }}
                  className={`relative w-24 cursor-grab overflow-hidden rounded-md border bg-white active:cursor-grabbing ${
                    dragId === id ? "opacity-40" : ""
                  } ${overId === id && dragId !== id ? "border-gray-800 ring-2 ring-gray-800" : "border-gray-300"}`}
                >
                  <div className="wf-image aspect-square border-b border-gray-300" />
                  <p className="truncate px-1.5 py-1 text-xs text-gray-700" title={byId[id]?.name}>{byId[id]?.name ?? t("Missing file")}</p>
                  <span className="absolute left-1 top-1 flex h-5 items-center rounded bg-white/90 px-0.5 text-gray-500 ring-1 ring-gray-300" aria-hidden>
                    <GripVertical size={12} />
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange(ids.filter((x) => x !== id))}
                    aria-label={t("Remove")}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-gray-500 ring-1 ring-gray-300 hover:text-red-600"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {ids.length > 0 && (
            <div className="flex items-center gap-3">
              {chooseButton("Add or remove files")}
              {ids.length > 1 && <span className="text-xs text-gray-400">{t("Drag to reorder")}</span>}
            </div>
          )}
        </div>
      )}

      <Library open={open} onClose={() => setOpen(false)} media={media} selected={ids} multiple={multiple} onConfirm={confirm} />
    </div>
  );
}
