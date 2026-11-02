import { useRef, useState } from "react";
import { Upload, List, LayoutGrid, Trash2, X } from "lucide-react";
import { useLocalStorage } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { seedMedia, seedUsers, getUser } from "../lib/seed";
import BulkActionsMenu from "../components/BulkActionsMenu";
import DataTable from "../components/DataTable";
import Avatar from "../components/Avatar";
import { FilterBar } from "../components/FilterBar";
import SegmentedControl from "../components/SegmentedControl";
import MediaThumb from "../components/MediaThumb";
import { useMediaUpload } from "../lib/mediaUpload";

function formatDate(iso, locale) {
  return new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatSize(kb) {
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

export default function Media() {
  const { t, dateLocale } = useI18n();
  const [media, setMedia] = useLocalStorage("cms.media", seedMedia);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [view, setView] = useState("list");
  const [filterValues, setFilterValues] = useState({ kind: null, uploadedBy: null });
  const [message, setMessage] = useState("");
  const [dropping, setDropping] = useState(false);
  const fileRef = useRef(null);
  const { upload, busy } = useMediaUpload({ media, setMedia, userId: seedUsers()[0]?.id });

  async function handleFiles(fileList) {
    if (!fileList.length || busy) return;
    setMessage("");
    const { added, message: problems } = await upload(fileList);
    setMessage(problems);
    // Show the new files even if a filter or search would hide them.
    if (added.length) { setSearch(""); setFilterValues({ kind: null, uploadedBy: null }); }
  }

  const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes("Files");

  const kindOptions = [...new Set(media.map((m) => m.kind))].map((k) => ({ value: k, label: k }));
  const filterFields = [
    { key: "kind", label: "Type", options: kindOptions },
    { key: "uploadedBy", label: "Uploaded by", options: seedUsers().map((u) => ({ value: u.id, label: u.name })) },
  ];

  const filtered = media.filter((m) => {
    if (filterValues.kind && m.kind !== filterValues.kind) return false;
    if (filterValues.uploadedBy && m.uploadedBy !== filterValues.uploadedBy) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const bulkActions = [
    {
      label: "Delete", icon: Trash2, danger: true,
      onSelect: () => { setMedia(media.filter((m) => !selected.has(m.id))); setSelected(new Set()); },
      confirm: { title: "Delete selected files?", message: "{n} selected will be permanently deleted. Content that uses them will lose the reference. This can't be undone.", confirmLabel: "Delete" },
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Name",
      sortValue: (r) => r.name,
      render: (r) => (
        <span className="inline-flex items-center gap-2.5">
          <MediaThumb item={r} className="block h-8 w-8 border border-gray-300" />
          <span className="font-medium text-gray-900">{r.name}</span>
        </span>
      ),
    },
    { key: "kind", header: "Type", render: (r) => <span className="text-gray-500">{r.kind}</span> },
    { key: "sizeKb", header: "Size", sortValue: (r) => r.sizeKb, render: (r) => <span className="text-gray-500">{formatSize(r.sizeKb)}</span> },
    { key: "updatedAt", header: "Uploaded", sortValue: (r) => r.updatedAt, render: (r) => <span className="text-gray-500">{formatDate(r.updatedAt, dateLocale)}</span> },
    {
      key: "uploadedBy",
      header: "Uploaded by",
      render: (r) => {
        const u = getUser(r.uploadedBy);
        return (
          <span className="inline-flex items-center gap-2">
            <Avatar user={u} size={20} />
            <span className="text-gray-600">{u.name}</span>
          </span>
        );
      },
    },
  ];

  return (
    <div
      className={`relative flex-1 overflow-y-auto p-6 ${dropping ? "outline-2 -outline-offset-8 outline-dashed outline-gray-400" : ""}`}
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); setDropping(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropping(false); }}
      onDrop={(e) => { if (hasFiles(e)) { e.preventDefault(); setDropping(false); handleFiles([...e.dataTransfer.files]); } }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{t("Media library")}</h1>
          <BulkActionsMenu count={selected.size} actions={bulkActions} />
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: "List", icon: List },
              { value: "grid", label: "Icons", icon: LayoutGrid },
            ]}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => { handleFiles([...e.target.files]); e.target.value = ""; }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
          >
            <Upload size={15} /> {busy ? t("Uploading…") : t("Upload")}
          </button>
        </div>
      </div>

      {message && (
        <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          <span>{message}</span>
          <button onClick={() => setMessage("")} aria-label={t("Dismiss")} className="shrink-0 rounded p-0.5 hover:bg-amber-100"><X size={14} /></button>
        </div>
      )}

      <div className="mb-4 max-w-md">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          filterFields={filterFields}
          filterValues={filterValues}
          onFilterChange={(key, value) => setFilterValues((v) => ({ ...v, [key]: value }))}
          onClearFilters={() => setFilterValues({ kind: null, uploadedBy: null })}
        />
      </div>

      {view === "list" ? (
        <div className="rounded-lg border border-gray-300 bg-white">
          <DataTable columns={columns} rows={filtered} selected={selected} onSelectedChange={setSelected} defaultSort={{ key: "updatedAt", dir: "desc" }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filtered.map((r) => {
            const u = getUser(r.uploadedBy);
            return (
              <div
                key={r.id}
                className="group overflow-hidden rounded-lg border border-gray-300 bg-white hover:border-gray-400 hover:shadow-sm"
              >
                <MediaThumb item={r} className="aspect-square w-full border-b border-gray-300" />
                <div className="p-2.5">
                  <p className="truncate text-sm font-medium text-gray-900" title={r.name}>{r.name}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                    <span>{formatSize(r.sizeKb)}</span>
                    <Avatar user={u} size={16} />
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-gray-400">{t("No items to show.")}</p>
          )}
        </div>
      )}
    </div>
  );
}
