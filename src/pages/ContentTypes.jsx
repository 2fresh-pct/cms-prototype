import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { useLocalStorage } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { seedContentTypes, seedEntries, FIELD_TYPE_LIST } from "../lib/seed";
import { typeIcon, TYPE_ICON_KEYS } from "../lib/typeIcons";
import Modal from "../components/Modal";
import BulkActionsMenu from "../components/BulkActionsMenu";
import DataTable from "../components/DataTable";
import { FilterBar } from "../components/FilterBar";

export default function ContentTypes() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [contentTypes, setContentTypes] = useLocalStorage("cms.contentTypes", seedContentTypes);
  const [entries] = useLocalStorage("cms.entries", seedEntries);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [filterValues, setFilterValues] = useState({ fieldType: null });
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("file-text");

  const trimmed = newName.trim();
  const nameTaken = contentTypes.some((ct) => ct.name.toLowerCase() === trimmed.toLowerCase());

  function openCreate() {
    setNewName("");
    setNewIcon("file-text");
    setCreating(true);
  }

  // A new type starts with the three fields every entry shows (title, slug and
  // body), which can be changed or removed in the editor.
  function createType() {
    if (!trimmed || nameTaken) return;
    const id = `ct-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
    const colors = ["#3b82f6", "#8b5cf6", "#0ea5e9", "#0d9488", "#f59e0b", "#ec4899"];
    setContentTypes([
      ...contentTypes,
      {
        id,
        name: trimmed,
        icon: newIcon,
        color: colors[contentTypes.length % colors.length],
        fields: [
          { name: "title", label: "Title", type: "Text", core: "title", required: true, localized: true },
          { name: "slug", label: "Slug", type: "Text", core: "slug", required: true, localized: true },
          { name: "body", label: "Body", type: "Rich text", core: "body", localized: true },
        ],
        entryCount: 0,
      },
    ]);
    setCreating(false);
    navigate(`/content-types/${id}`);
  }

  const filterFields = [
    { key: "fieldType", label: "Has field type", options: FIELD_TYPE_LIST.map((ft) => ({ value: ft, label: ft })) },
  ];

  // Counted from the entries, so it stays right as entries are created and deleted.
  const countOf = (ct) => entries.filter((e) => e.contentTypeId === ct.id).length;

  const filtered = contentTypes.filter((t) => {
    if (filterValues.fieldType && !t.fields.some((f) => f.type === filterValues.fieldType)) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const inUse = [...selected].some((id) => entries.some((e) => e.contentTypeId === id));
  const bulkActions = [
    {
      label: "Delete", icon: Trash2, danger: true,
      disabled: inUse, hint: "Types that still have entries can't be deleted",
      onSelect: () => { setContentTypes(contentTypes.filter((ct) => !selected.has(ct.id))); setSelected(new Set()); },
      confirm: { title: "Delete selected content types?", message: "{n} selected will be permanently deleted. This can't be undone.", confirmLabel: "Delete" },
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Name",
      sortValue: (r) => r.name,
      render: (r) => {
        const Icon = typeIcon(r.icon);
        return (
          <span className="inline-flex items-center gap-2 font-medium text-gray-900">
            <Icon size={15} style={{ color: r.color }} />
            {t(r.name)}
          </span>
        );
      },
    },
    {
      key: "entryCount",
      header: "Entries",
      sortValue: (r) => countOf(r),
      render: (r) => <span className="text-gray-500">{countOf(r)}</span>,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{t("Content types")}</h1>
          <BulkActionsMenu count={selected.size} actions={bulkActions} />
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-md bg-violet-600 h-9 px-3 text-sm font-medium text-white hover:bg-violet-700">
          <Plus size={15} /> {t("Create new")}
        </button>
      </div>

      <div className="mb-4 max-w-md">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          filterFields={filterFields}
          filterValues={filterValues}
          onFilterChange={(key, value) => setFilterValues((v) => ({ ...v, [key]: value }))}
          onClearFilters={() => setFilterValues({ fieldType: null })}
        />
      </div>

      <div className="rounded-lg border border-gray-300 bg-white">
        <DataTable
          columns={columns}
          rows={filtered}
          selected={selected}
          onSelectedChange={setSelected}
          onRowClick={(row) => navigate(`/content-types/${row.id}`)}
        />
      </div>
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t("New content type")}
        footer={
          <>
            <button onClick={() => setCreating(false)} className="rounded-md h-9 px-3 text-sm text-gray-500 hover:bg-gray-100">{t("Cancel")}</button>
            <button
              onClick={createType}
              disabled={!trimmed || nameTaken}
              className="rounded-md bg-gray-700 h-9 px-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
            >
              {t("Create")}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">{t("Name")}</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createType(); }}
              className="w-full rounded-md border border-gray-300 bg-white h-9 px-3 text-sm focus:border-violet-400 focus:outline-none"
            />
            {nameTaken && <p className="mt-1 text-xs text-red-600">{t("A content type with this name already exists.")}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">{t("Icon")}</label>
            <div className="grid grid-cols-6 gap-1.5">
              {TYPE_ICON_KEYS.map((key) => {
                const Icon = typeIcon(key);
                const active = newIcon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setNewIcon(key)}
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
          </div>
        </div>
      </Modal>
    </div>
  );
}
