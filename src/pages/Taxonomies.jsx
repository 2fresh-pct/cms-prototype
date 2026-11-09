import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ListTree, Trash2, Copy } from "lucide-react";
import { useLocalStorage } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { seedTaxonomies, seedContentTypes, countTerms } from "../lib/seed";
import BulkActionsMenu from "../components/BulkActionsMenu";
import DataTable from "../components/DataTable";
import { FilterBar } from "../components/FilterBar";

export default function Taxonomies() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [taxonomies, setTaxonomies] = useLocalStorage("cms.taxonomies", seedTaxonomies);
  const [contentTypes] = useLocalStorage("cms.contentTypes", seedContentTypes);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());

  const filtered = taxonomies.filter((tx) => !search || tx.name.toLowerCase().includes(search.toLowerCase()));

  function createTaxonomy() {
    const id = `tax-${Date.now()}`;
    setTaxonomies([...taxonomies, { id, name: t("New taxonomy"), description: "", terms: [] }]);
    navigate(`/taxonomies/${id}`);
  }

  const inUse = [...selected].some((id) => contentTypes.some((ct) => ct.fields.some((f) => f.taxonomyId === id)));
  // A copy has the same description and terms (nested as in the original, with
  // new ids) under a new name. Content types and entries keep using the original.
  function duplicateSelected() {
    const taken = new Set(taxonomies.map((tx) => tx.name.toLowerCase()));
    const stamp = Date.now();
    const copyTerms = (terms, suffix) => terms.map((term) => ({
      ...term,
      id: `${term.id}-${suffix}`,
      ...(term.children ? { children: copyTerms(term.children, suffix) } : {}),
    }));
    const copies = taxonomies.filter((tx) => selected.has(tx.id)).map((tx, i) => {
      let name = `${tx.name} (${t("copy")})`;
      for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `${tx.name} (${t("copy")} ${n})`;
      taken.add(name.toLowerCase());
      return { ...structuredClone(tx), id: `tax-${stamp}-${i}`, name, terms: copyTerms(tx.terms ?? [], `c${stamp}${i}`) };
    });
    setTaxonomies([...taxonomies, ...copies]);
    setSelected(new Set());
  }

  const bulkActions = [
    { label: "Duplicate", icon: Copy, onSelect: duplicateSelected },
    {
      label: "Delete", icon: Trash2, danger: true,
      disabled: inUse, hint: "Taxonomies used by a content type can't be deleted",
      onSelect: () => { setTaxonomies(taxonomies.filter((tx) => !selected.has(tx.id))); setSelected(new Set()); },
      confirm: { title: "Delete selected taxonomies?", message: "{n} selected will be permanently deleted with all their terms. This can't be undone.", confirmLabel: "Delete" },
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Name",
      sortValue: (r) => r.name,
      render: (r) => (
        <span className="inline-flex items-center gap-2 font-medium text-gray-900">
          <ListTree size={15} className="text-violet-600" />
          {r.name}
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (r) => <span className="text-gray-500">{r.description || "—"}</span>,
    },
    {
      key: "terms",
      header: "Terms",
      sortValue: (r) => countTerms(r.terms),
      render: (r) => <span className="text-gray-500">{countTerms(r.terms)}</span>,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{t("Taxonomies")}</h1>
          <BulkActionsMenu count={selected.size} actions={bulkActions} />
        </div>
        <button
          onClick={createTaxonomy}
          className="flex items-center gap-1.5 rounded-md bg-violet-600 h-9 px-3 text-sm font-medium text-white hover:bg-violet-700"
        >
          <Plus size={15} /> {t("Create new")}
        </button>
      </div>

      <div className="mb-4 max-w-md">
        <FilterBar search={search} onSearchChange={setSearch} />
      </div>

      <div className="rounded-lg border border-gray-300 bg-white">
        <DataTable
          columns={columns}
          rows={filtered}
          selected={selected}
          onSelectedChange={setSelected}
          onRowClick={(row) => navigate(`/taxonomies/${row.id}`)}
        />
      </div>
    </div>
  );
}
