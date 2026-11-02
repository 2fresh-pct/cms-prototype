import { useEffect, useState } from "react";
import { useParams, useNavigate, useBlocker } from "react-router-dom";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useLocalStorage } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { seedContentTypes, seedTaxonomies, FIELD_TYPE_LIST } from "../lib/seed";
import { TYPE_ICON_KEYS, typeIcon } from "../lib/typeIcons";
import PageHeader from "../components/PageHeader";
import DetailField from "../components/DetailField";
import Modal from "../components/Modal";

export default function ContentTypeDetail() {
  const { id } = useParams();
  // Keyed so each content type starts from its own saved state.
  return <ContentTypeEditor key={id} id={id} />;
}

// Content types shape every entry of that type, so edits are held in a draft
// and only applied by Save, never autosaved.
function ContentTypeEditor({ id }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [contentTypes, setContentTypes] = useLocalStorage("cms.contentTypes", seedContentTypes);
  const [taxonomies] = useLocalStorage("cms.taxonomies", seedTaxonomies);

  const type = contentTypes.find((ct) => ct.id === id);
  const [draft, setDraft] = useState(type);
  const [justSaved, setJustSaved] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const dirty = Boolean(type) && JSON.stringify(draft) !== JSON.stringify(type);
  const blocker = useBlocker(dirty);

  // Closing or reloading the tab with unsaved changes asks first, too.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!type) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">{t("Content type not found.")}</p>
        <button onClick={() => navigate("/content-types")} className="mt-2 text-sm font-medium text-violet-600 hover:text-violet-700">
          {t("Back to Content types")}
        </button>
      </div>
    );
  }

  function update(patch) {
    setDraft((d) => ({ ...d, ...patch }));
    setJustSaved(false);
  }

  // Written to storage right away as well as to state: when saving from the
  // leave dialog the page unmounts in the same step, before an effect would.
  function save() {
    const saved = { ...draft, name: draft.name.trim() || type.name };
    const next = contentTypes.map((ct) => (ct.id === id ? { ...ct, ...saved } : ct));
    localStorage.setItem("cms.contentTypes", JSON.stringify(next));
    setContentTypes(next);
    setDraft({ ...type, ...saved });
    setJustSaved(true);
  }

  function discard() {
    setDraft(type);
  }

  // A field's type is only editable until the type is saved with it; after that
  // existing entries hold values of that type. Names are also unique against the
  // saved fields so a new field is never mistaken for a removed saved one.
  const savedNames = new Set(type.fields.map((f) => f.name));
  const typeLocked = (f) => savedNames.has(f.name);

  function addField() {
    const used = new Set([...savedNames, ...draft.fields.map((f) => f.name)]);
    let n = draft.fields.length + 1;
    while (used.has(`field${n}`)) n += 1;
    update({ fields: [...draft.fields, { name: `field${n}`, label: "New field", type: "Text" }] });
  }

  function removeField(i) {
    update({ fields: draft.fields.filter((_, idx) => idx !== i) });
  }

  // Dropping a field card onto another moves it to that position; the editor
  // renders a type's fields in this order.
  function moveField(from, to) {
    if (from !== null && from !== to) {
      const next = [...draft.fields];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      update({ fields: next });
    }
    setDragIndex(null);
    setOverIndex(null);
  }

  function updateField(i, patch) {
    update({ fields: draft.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });
  }

  
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <PageHeader
        crumbs={["Content types", draft.name || type.name]}
        onBack={() => navigate(-1)}
        saveStatus={dirty ? "unsaved" : justSaved ? "saved" : null}
        actions={
          <>
            {dirty && (
              <button onClick={discard} className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100">
                {t("Discard changes")}
              </button>
            )}
            <button
              onClick={save}
              disabled={!dirty}
              className="rounded-md bg-gray-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("Save")}
            </button>
          </>
        }
      />

      <div className="flex gap-6">
        <div className="flex-1 space-y-5 rounded-lg border border-gray-300 bg-white p-5">
          <DetailField label="Name">
            <input
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
            />
          </DetailField>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-gray-400">{t("Fields")}</label>
              <button onClick={addField} className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Plus size={14} /> {t("Add field")}
              </button>
            </div>
            <div className="space-y-2">
              {draft.fields.map((f, i) => (
                <div
                  key={i}
                  onDragOver={(e) => { if (dragIndex !== null) { e.preventDefault(); if (overIndex !== i) setOverIndex(i); } }}
                  onDrop={(e) => { e.preventDefault(); moveField(dragIndex, i); }}
                  className={`space-y-2 rounded-md border bg-white p-2 ${dragIndex === i ? "opacity-40" : ""} ${
                    overIndex === i && dragIndex !== null && dragIndex !== i ? "border-gray-800 ring-2 ring-gray-800" : "border-gray-300"
                  }`}
                >
                  <div className="flex flex-wrap items-end gap-2">
                    <span
                      draggable
                      title={t("Drag to reorder")}
                      aria-label={t("Drag to reorder")}
                      onDragStart={(e) => {
                        setDragIndex(i);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setDragImage(e.currentTarget.closest("[class*=rounded-md]"), 12, 12);
                      }}
                      onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                      className="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
                    >
                      <GripVertical size={15} />
                    </span>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">{t("Type")}</label>
                      <select
                        value={f.type}
                        disabled={typeLocked(f)}
                        title={typeLocked(f) ? t("The type of a saved field can't be changed. Add a new field instead.") : undefined}
                        onChange={(e) => {
                          const nextType = e.target.value;
                          updateField(i, {
                            type: nextType,
                            taxonomyId: nextType === "Taxonomy" ? (f.taxonomyId ?? taxonomies[0]?.id) : undefined,
                          });
                        }}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                      >
                        {FIELD_TYPE_LIST.filter((ft) => ft !== "Media list" || f.type === "Media list").map((ft) => (
                          <option key={ft} value={ft}>{t(ft)}</option>
                        ))}
                      </select>
                    </div>
                    {f.type === "Taxonomy" && (
                      <div>
                        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">{t("Taxonomy")}</label>
                        <select
                          value={f.taxonomyId ?? ""}
                          onChange={(e) => updateField(i, { taxonomyId: e.target.value })}
                          className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-sm text-violet-700"
                        >
                          <option value="" disabled>{t("Choose taxonomy…")}</option>
                          {taxonomies.map((tx) => (
                            <option key={tx.id} value={tx.id}>{tx.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400">{t("Name")}</label>
                      <input
                        value={f.label ?? f.name}
                        onChange={(e) => updateField(i, { label: e.target.value })}
                        aria-label={t("Label")}
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                      />
                    </div>
                    <button onClick={() => removeField(i)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{f.name}</code>
                    {f.group && <span>{t(f.group)}</span>}
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={Boolean(f.required)}
                        onChange={(e) => updateField(i, { required: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-gray-300 accent-violet-600"
                      />
                      {f.required === "conditional" ? t("Required in some cases") : t("Required")}
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={Boolean(f.localized)}
                        onChange={(e) => updateField(i, { localized: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-gray-300 accent-violet-600"
                      />
                      {f.localized === "partly" ? t("Partly localized") : t("Localized")}
                    </label>
                    {f.type === "Media" && (
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={f.multiple === true}
                          onChange={(e) => updateField(i, { multiple: e.target.checked })}
                          className="h-3.5 w-3.5 rounded border-gray-300 accent-violet-600"
                        />
                        {t("Allow several files")}
                      </label>
                    )}
                    {f.type === "Taxonomy" && (
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={f.multiple !== false}
                          onChange={(e) => updateField(i, { multiple: e.target.checked })}
                          className="h-3.5 w-3.5 rounded border-gray-300 accent-violet-600"
                        />
                        {t("Allow several terms")}
                      </label>
                    )}
                  </div>
                </div>
              ))}
              {draft.fields.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-400">{t("No fields yet.")}</p>
              )}
            </div>
          </div>
        </div>

        <div className="w-72 shrink-0 space-y-5 rounded-lg border border-gray-300 bg-white p-5">
          <DetailField label="Icon">
            <div className="grid grid-cols-6 gap-1.5">
              {TYPE_ICON_KEYS.map((key) => {
                const Icon = typeIcon(key);
                const active = (draft.icon ?? "file-text") === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => update({ icon: key })}
                    aria-label={key}
                    aria-pressed={active}
                    title={key}
                    className={`flex h-9 items-center justify-center rounded-md border ${
                      active ? "border-gray-700 bg-gray-100 text-gray-900" : "border-gray-300 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
          </DetailField>
          <DetailField label="Entries using this type">
            <span className="text-sm text-gray-700">{type.entryCount}</span>
          </DetailField>
        </div>
      </div>

      <Modal
        open={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
        title={t("Save your changes?")}
        footer={
          <>
            <button onClick={() => blocker.reset?.()} className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100">
              {t("Keep editing")}
            </button>
            <button onClick={() => blocker.proceed?.()} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
              {t("Discard changes")}
            </button>
            <button
              onClick={() => { save(); blocker.proceed?.(); }}
              className="rounded-md bg-gray-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              {t("Save changes")}
            </button>
          </>
        }
      >
        {t("Changes to a content type affect every entry of that type. You have unsaved changes to this one.")}
      </Modal>
    </div>
  );
}
