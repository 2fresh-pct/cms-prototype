import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useBlocker } from "react-router-dom";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useLocalStorage } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { seedContentTypes, seedEntries, seedTaxonomies, FIELD_TYPE_LIST, fieldTypeLabel } from "../lib/seed";
import { TYPE_ICON_KEYS, typeIcon } from "../lib/typeIcons";
import { TYPE_COLORS } from "../lib/typeColors";
import PageHeader from "../components/PageHeader";
import DetailField from "../components/DetailField";
import Modal from "../components/Modal";
import AddFieldDialog from "../components/AddFieldDialog";
import GroupTabs from "../components/GroupTabs";
import { GENERAL, groupsOf } from "../lib/groups";

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
  const [entries] = useLocalStorage("cms.entries", seedEntries);

  const type = contentTypes.find((ct) => ct.id === id);
  const entryCount = entries.filter((e) => e.contentTypeId === id).length;
  // Types saved before groups were listed explicitly get them from their fields,
  // so opening one doesn't count as a change.
  const baseline = useMemo(() => (type ? { ...type, groups: groupsOf(type) } : undefined), [type]);
  const [draft, setDraft] = useState(baseline);
  const [justSaved, setJustSaved] = useState(false);
  const [activeGroup, setActiveGroup] = useState(GENERAL);
  const [focusGroupName, setFocusGroupName] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [addingField, setAddingField] = useState(false);

  const dirty = Boolean(type) && JSON.stringify(draft) !== JSON.stringify(baseline);
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
    setDraft(baseline);
  }

  // A field's type is only editable until the type is saved with it; after that
  // existing entries hold values of that type. Names are also unique against the
  // saved fields so a new field is never mistaken for a removed saved one.
  const savedNames = new Set(type.fields.map((f) => f.name));
  const typeLocked = (f) => savedNames.has(f.name);

  // The API key of a new field comes from its name ("Opening hours note" ->
  // openingHoursNote), without accents, and is made unique among all fields.
  function fieldKeyFor(label, used) {
    const words = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^A-Za-z0-9]+/).filter(Boolean);
    let base = words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join("");
    if (!base || /^[0-9]/.test(base)) base = `field${base}`;
    let key = base;
    for (let n = 2; used.has(key); n += 1) key = `${base}${n}`;
    return key;
  }

  function addField({ label, type: fieldType }) {
    const used = new Set([...savedNames, ...draft.fields.map((f) => f.name)]);
    const name = fieldKeyFor(label || fieldType, used);
    const field = {
      name,
      label: label || fieldType,
      type: fieldType,
      group: activeName,
      ...(fieldType === "Taxonomy" ? { taxonomyId: taxonomies[0]?.id } : {}),
    };
    update({ fields: [...draft.fields, field] });
    setAddingField(false);
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

  // Groups are the tabs fields sit under (see lib/groups). A field with no group
  // is in "General", which is not a real group and so can't be renamed or deleted.
  const groups = draft.groups ?? [];
  const hasGeneral = draft.fields.some((f) => !f.group || !groups.includes(f.group));
  const tabIds = [...(hasGeneral || groups.length === 0 ? [GENERAL] : []), ...groups];
  const activeId = tabIds.includes(activeGroup) ? activeGroup : tabIds[0];
  const activeName = activeId === GENERAL ? null : activeId;
  const inActive = (f) => (activeName === null ? !f.group || !groups.includes(f.group) : f.group === activeName);

  function addGroup() {
    let name = t("New group");
    for (let n = 2; groups.includes(name); n += 1) name = `${t("New group")} ${n}`;
    update({ groups: [...groups, name] });
    setActiveGroup(name);
    setFocusGroupName(true);
  }

  // Renaming keeps the group's fields in it; an empty or taken name is refused.
  function renameGroup(from, to) {
    const name = to.trim();
    if (!name || name === from || groups.includes(name)) return false;
    update({
      groups: groups.map((g) => (g === from ? name : g)),
      fields: draft.fields.map((f) => (f.group === from ? { ...f, group: name } : f)),
    });
    setActiveGroup(name);
    return true;
  }

  // Deleting a group never deletes its fields: they go back to General.
  function deleteGroup(name) {
    update({
      groups: groups.filter((g) => g !== name),
      fields: draft.fields.map((f) => (f.group === name ? { ...f, group: null } : f)),
    });
    setActiveGroup(GENERAL);
  }

  function moveGroup(from, to) {
    const next = groups.filter((g) => g !== from);
    next.splice(next.indexOf(to) + (groups.indexOf(from) < groups.indexOf(to) ? 1 : 0), 0, from);
    update({ groups: next });
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
              <button onClick={discard} className="rounded-md h-9 px-3 text-sm text-gray-500 hover:bg-gray-100">
                {t("Discard changes")}
              </button>
            )}
            <button
              onClick={save}
              disabled={!dirty}
              className="rounded-md bg-gray-700 h-9 px-3 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
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
              className="w-full rounded-md border border-gray-300 bg-white h-9 px-3 text-sm focus:border-violet-400 focus:outline-none"
            />
          </DetailField>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-gray-400">{t("Fields")}</label>
              <button onClick={() => setAddingField(true)} className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white h-9 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Plus size={14} /> {t("Add field")}
              </button>
            </div>
            <div className="mb-3">
              <GroupTabs
                tabs={tabIds.map((id) => ({ id, label: id === GENERAL ? "General" : id }))}
                active={activeId}
                onSelect={setActiveGroup}
                onMove={moveGroup}
                fixedId={GENERAL}
                trailing={
                  <button onClick={addGroup} className="flex items-center gap-1 rounded-md h-7 px-2 text-xs font-medium text-gray-600 hover:bg-gray-100">
                    <Plus size={13} /> {t("Add group")}
                  </button>
                }
              />
              {activeName !== null && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="text-xs text-gray-500" htmlFor="group-name">{t("Group name")}</label>
                  <input
                    id="group-name"
                    key={activeName}
                    defaultValue={activeName}
                    autoFocus={focusGroupName}
                    onFocus={(e) => { if (focusGroupName) { e.target.select(); setFocusGroupName(false); } }}
                    onBlur={(e) => { if (!renameGroup(activeName, e.target.value)) e.target.value = activeName; }}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    className="w-48 rounded-md border border-gray-300 bg-white h-8 px-2.5 text-sm focus:border-violet-400 focus:outline-none"
                  />
                  <button
                    onClick={() => deleteGroup(activeName)}
                    className="flex items-center gap-1 rounded-md h-7 px-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-red-600"
                  >
                    <Trash2 size={13} /> {t("Delete group")}
                  </button>
                  <span className="text-xs text-gray-400">{t("Its fields move to General.")}</span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {draft.fields.map((f, i) => !inActive(f) ? null : (
                <div
                  key={i}
                  onDragOver={(e) => { if (dragIndex !== null) { e.preventDefault(); if (overIndex !== i) setOverIndex(i); } }}
                  onDrop={(e) => { e.preventDefault(); moveField(dragIndex, i); }}
                  className={`space-y-3 rounded-md border bg-[#fff] p-3 ${dragIndex === i ? "opacity-40" : ""} ${
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
                      className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
                    >
                      <GripVertical size={15} />
                    </span>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">{t("Type")}</label>
                      <select
                        value={f.type}
                        disabled={typeLocked(f)}
                        title={typeLocked(f) ? t("The type of a saved field can't be changed. Add a new field instead.") : undefined}
                        onChange={(e) => {
                          const nextType = e.target.value;
                          updateField(i, {
                            type: nextType,
                            taxonomyId: nextType === "Taxonomy" ? (f.taxonomyId ?? taxonomies[0]?.id) : undefined,
                            ...(nextType === "Separator" ? { required: false, localized: false } : {}),
                          });
                        }}
                        className="w-48 rounded-md border border-gray-300 bg-white h-8 px-2.5 text-sm disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                      >
                        {FIELD_TYPE_LIST.filter((ft) => ft !== "Media list" || f.type === "Media list").map((ft) => (
                          <option key={ft} value={ft}>{t(fieldTypeLabel(ft))}</option>
                        ))}
                      </select>
                    </div>
                    {f.type === "Taxonomy" && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">{t("Taxonomy")}</label>
                        <select
                          value={f.taxonomyId ?? ""}
                          onChange={(e) => updateField(i, { taxonomyId: e.target.value })}
                          className="rounded-md border border-violet-200 bg-violet-50 h-8 px-2.5 text-sm text-violet-700"
                        >
                          <option value="" disabled>{t("Choose taxonomy…")}</option>
                          {taxonomies.map((tx) => (
                            <option key={tx.id} value={tx.id}>{tx.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {f.type === "Separator" ? (
                      <div className="flex h-8 min-w-32 flex-1 items-center gap-3 text-xs text-gray-400">
                        <span className="h-px w-10 shrink-0 bg-gray-300" aria-hidden />
                        {t("Layout only: draws a line in the editor. It holds no content.")}
                      </div>
                    ) : (
                    <div className="min-w-32 flex-1">
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">{t("Name")}</label>
                      <input
                        value={f.label ?? f.name}
                        onChange={(e) => updateField(i, { label: e.target.value })}
                        aria-label={t("Label")}
                        className="w-full rounded-md border border-gray-300 bg-white h-8 px-2.5 text-sm"
                      />
                    </div>
                    )}
                    <button onClick={() => removeField(i)} aria-label={t("Delete field")} className="ml-auto flex h-8 w-8 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {f.type === "Reference" && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-7 text-xs text-gray-500">
                      <span className="mr-1">{t("Can link to")}</span>
                      {contentTypes.map((ct) => {
                        const on = f.targetTypeIds?.includes(ct.id);
                        return (
                          <button
                            key={ct.id}
                            type="button"
                            aria-pressed={Boolean(on)}
                            onClick={() => {
                              const current = f.targetTypeIds ?? [];
                              updateField(i, { targetTypeIds: on ? current.filter((x) => x !== ct.id) : [...current, ct.id] });
                            }}
                            className={`h-7 rounded-full border px-3 ${on ? "border-gray-800 bg-gray-800 text-white" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
                          >
                            {t(ct.name)}
                          </button>
                        );
                      })}
                      {!f.targetTypeIds?.length && <span className="text-gray-400">{f.targetName ? t(f.targetName) : t("Any content type")}</span>}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-2 pl-7 text-xs text-gray-500">
                    <div className="w-48 shrink-0">
                      {/* A separator is layout only: it has no API key and never appears in the content. */}
                      {f.type !== "Separator" && <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{f.name}</code>}
                    </div>
                    <label className="flex w-40 shrink-0 items-center gap-2">
                      {t("Group")}
                      <select
                        value={f.group && groups.includes(f.group) ? f.group : ""}
                        onChange={(e) => updateField(i, { group: e.target.value || null })}
                        className="h-7 min-w-0 flex-1 rounded border border-gray-300 bg-white px-1.5 text-xs text-gray-700"
                      >
                        <option value="">{t("General")}</option>
                        {groups.map((g) => <option key={g} value={g}>{t(g)}</option>)}
                      </select>
                    </label>
                    {f.type !== "Separator" && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-2">
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
                          checked={f.multiple !== false}
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
                    )}
                  </div>
                </div>
              ))}
              {!draft.fields.some(inActive) && (
                <p className="py-4 text-center text-sm text-gray-400">{activeName === null ? t("No fields yet.") : t("No fields in this group yet.")}</p>
              )}
            </div>
          </div>
        </div>

        <div className="w-80 shrink-0 space-y-5 self-start rounded-lg border border-gray-300 bg-white p-5">
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
          <DetailField label="Color">
            <div className="flex flex-wrap gap-2">
              {TYPE_COLORS.map((color) => {
                const active = (draft.color ?? "").toLowerCase() === color;
                const taken = contentTypes.some((ct) => ct.id !== id && (ct.color ?? "").toLowerCase() === color);
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => update({ color })}
                    aria-label={color}
                    aria-pressed={active}
                    title={taken ? t("Also used by another content type") : color}
                    className={`h-7 w-7 rounded-full border-2 ${active ? "border-gray-800" : "border-white"} ring-1 ring-gray-300 ${taken ? "opacity-50" : ""}`}
                    style={{ backgroundColor: color }}
                  />
                );
              })}
            </div>
          </DetailField>
          <DetailField label="Entries using this type">
            <span className="text-sm text-gray-700">{entryCount}</span>
          </DetailField>
        </div>
      </div>

      <Modal
        open={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
        title={t("Save your changes?")}
        footer={
          <>
            <button onClick={() => blocker.reset?.()} className="rounded-md h-9 px-3 text-sm text-gray-500 hover:bg-gray-100">
              {t("Keep editing")}
            </button>
            <button onClick={() => blocker.proceed?.()} className="rounded-md border border-gray-300 h-9 px-3 text-sm font-medium text-red-600 hover:bg-red-50">
              {t("Discard changes")}
            </button>
            <button
              onClick={() => { save(); blocker.proceed?.(); }}
              className="rounded-md bg-gray-700 h-9 px-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              {t("Save changes")}
            </button>
          </>
        }
      >
        {t("Changes to a content type affect every entry of that type. You have unsaved changes to this one.")}
      </Modal>

      <AddFieldDialog open={addingField} onClose={() => setAddingField(false)} onAdd={addField} />
    </div>
  );
}
