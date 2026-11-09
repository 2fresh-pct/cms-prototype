import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useLocalStorage } from "../lib/storage";
import { seedCatalogueCategories, seedCatalogueItems, seedUsers, getUser, STATUS_LIST, LOCALE_LIST } from "../lib/seed";
import Sidebar from "../components/Sidebar";
import BulkActionBar from "../components/BulkActionBar";
import DataTable from "../components/DataTable";
import StatusPill from "../components/StatusPill";
import Avatar from "../components/Avatar";
import { FilterBar } from "../components/FilterBar";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Catalogue() {
  const navigate = useNavigate();
  const [categories, setCategories] = useLocalStorage("cms.catalogueCategories", seedCatalogueCategories);
  const [items, setItems] = useLocalStorage("cms.catalogueItems", seedCatalogueItems);
  const users = useMemo(() => seedUsers(), []);

  const [filter, setFilter] = useState({ view: "all", status: null, typeId: null });
  const [extraFilters, setExtraFilters] = useState({ locale: null, authorId: null });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());

  const activeCategory = categories.find((c) => c.id === filter.typeId);
  const title = activeCategory?.name ?? (filter.status ? filter.status : "All catalogue items");

  const statuses = STATUS_LIST.map((name) => ({
    name,
    count: items.filter((i) => i.status === name).length,
  }));

  const filterValues = { status: filter.status, categoryId: filter.typeId, ...extraFilters };

  function handleFilterChange(key, value) {
    if (key === "status") return setFilter({ view: value ? "status" : "all", status: value, typeId: null });
    if (key === "categoryId") return setFilter({ view: value ? "type" : "all", status: null, typeId: value });
    setExtraFilters((v) => ({ ...v, [key]: value }));
  }

  function clearFilters() {
    setFilter({ view: "all", status: null, typeId: null });
    setExtraFilters({ locale: null, authorId: null });
  }

  const filterFields = [
    { key: "status", label: "Status", options: STATUS_LIST.map((s) => ({ value: s, label: s })) },
    { key: "categoryId", label: "Category", options: categories.map((c) => ({ value: c.id, label: c.name })) },
    { key: "locale", label: "Locale", options: LOCALE_LIST.map((l) => ({ value: l, label: l.toUpperCase() })) },
    { key: "authorId", label: "Author", options: users.map((u) => ({ value: u.id, label: u.name })) },
  ];

  function deleteSelected() {
    if (selected.size === 0) return;
    const toDelete = items.filter((i) => selected.has(i.id));
    const perCategory = new Map();
    toDelete.forEach((i) => perCategory.set(i.categoryId, (perCategory.get(i.categoryId) ?? 0) + 1));
    setItems(items.filter((i) => !selected.has(i.id)));
    setCategories(categories.map((c) => (perCategory.has(c.id) ? { ...c, count: c.count - perCategory.get(c.id) } : c)));
    setSelected(new Set());
  }

  const filtered = items.filter((i) => {
    if (filter.typeId && i.categoryId !== filter.typeId) return false;
    if (filter.status && i.status !== filter.status) return false;
    if (extraFilters.locale && i.locale !== extraFilters.locale) return false;
    if (extraFilters.authorId && i.authorId !== extraFilters.authorId) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const columns = [
    {
      key: "name",
      header: "Name",
      sortValue: (r) => r.name,
      render: (r) => <span className="font-medium text-gray-900">{r.name}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => <StatusPill status={r.status} />,
    },
    {
      key: "url",
      header: "URL",
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-violet-600">
          <ExternalLink size={13} />
          <span className="max-w-[240px] truncate">{r.url}</span>
        </span>
      ),
    },
    { key: "updatedAt", header: "Modified", sortValue: (r) => r.updatedAt, render: (r) => <span className="text-gray-500">{formatDate(r.updatedAt)}</span> },
    { key: "lastReviewedAt", header: "Last reviewed", render: (r) => <span className="text-gray-400">{formatDate(r.lastReviewedAt)}</span> },
    {
      key: "author",
      header: "Author",
      render: (r) => {
        const u = getUser(r.authorId);
        return (
          <span className="inline-flex items-center gap-2">
            <Avatar user={u} size={20} />
            <span className="text-gray-600">{u.email}</span>
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex h-full min-h-0">
      <Sidebar
        allLabel="All catalogue"
        statuses={statuses}
        typeGroupLabel="Category"
        typeItems={categories.map((c) => ({ id: c.id, name: c.name, count: c.count }))}
        filter={filter}
        onFilter={(f) => { setFilter(f); setSelected(new Set()); setSearch(""); }}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {filter.view !== "all" && (
          <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-400">
            <span>Catalogue</span>
            <span>/</span>
            <span className="text-gray-600">{title}</span>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {filter.view !== "all" && (
              <button
                onClick={() => setFilter({ view: "all", status: null, typeId: null })}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <ArrowLeft size={17} />
              </button>
            )}
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          </div>
          <button className="rounded-md bg-violet-600 h-9 px-3 text-sm font-medium text-white hover:bg-violet-700">
            + Create new
          </button>
        </div>

        <div className="mb-3">
          <FilterBar
            typeFacetLabel="Category"
            search={search}
            onSearchChange={setSearch}
            typeLabel={activeCategory?.name ?? "Any"}
            typeOptions={categories.map((c) => ({ value: c.id, label: c.name }))}
            typeValue={filter.typeId}
            onTypeChange={(value) => handleFilterChange("categoryId", value)}
            filterFields={filterFields}
            filterValues={filterValues}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
          />
        </div>

        <div className="rounded-lg border border-gray-300 bg-white">
          <BulkActionBar count={selected.size} total={filtered.length} onDelete={deleteSelected} />
          <DataTable
            columns={columns}
            rows={filtered}
            selected={selected}
            onSelectedChange={setSelected}
            onRowClick={(row) => navigate(`/catalogue/item/${row.id}`)}
            defaultSort={{ key: "updatedAt", dir: "desc" }}
          />
        </div>
      </div>
    </div>
  );
}
