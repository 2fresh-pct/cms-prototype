import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, Plus, ChevronDown, ArrowUpDown, X, ListFilter } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { typeIcon } from "../lib/typeIcons";
import Modal from "./Modal";

// `typeFacetLabel` / `typeLabel` show the type chip next to the search box. With
// `typeOptions` ([{ value, label, icon?, color? }]), `typeValue` and `onTypeChange`
// the chip opens a dialog to pick the type (or Any), applied right away.
export function FilterBar({
  typeFacetLabel,
  typeLabel,
  typeOptions,
  typeValue = null,
  onTypeChange,
  search,
  onSearchChange,
  chips = [],
  sortLabel,
  onSortClick,
  filterFields = [],
  filterValues = {},
  onFilterChange,
  onClearFilters,
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [pickingType, setPickingType] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const activeCount = filterFields.filter((f) => filterValues[f.key]).length;

  return (
    <div className="space-y-2.5">
      <div className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-2">
        {typeFacetLabel && (
          <button
            type="button"
            onClick={() => typeOptions && setPickingType(true)}
            aria-haspopup={typeOptions ? "dialog" : undefined}
            className="flex items-center gap-1.5 rounded-md bg-gray-100 h-8 px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
          >
            {t(typeFacetLabel)}
            <span className="rounded bg-white px-1.5 py-0.5 text-gray-900 ring-1 ring-gray-300">{t(typeLabel ?? "Any")}</span>
          </button>
        )}
        <div className="flex flex-1 items-center gap-2 px-1">
          <Search size={14} className="text-gray-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("Type to search for entries")}
            className="w-full bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
          />
        </div>

        {filterFields.length > 0 && (
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen((v) => !v)}
              className={`flex items-center gap-1 rounded-md h-8 px-2.5 text-xs font-medium ${
                activeCount > 0 ? "bg-violet-50 text-violet-700" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <SlidersHorizontal size={13} />
              {t("Filter")}
              {activeCount > 0 && (
                <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[10px] text-white">
                  {activeCount}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-gray-300 bg-white p-3 wf-pop">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t("Filters")}</p>
                  {activeCount > 0 && (
                    <button
                      onClick={() => onClearFilters?.()}
                      className="text-xs font-medium text-gray-400 hover:text-gray-700"
                    >
                      {t("Clear all")}
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {filterFields.map((f) => (
                    <div key={f.key}>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">{t(f.label)}</label>
                      <div className="relative">
                        <select
                          value={filterValues[f.key] ?? ""}
                          onChange={(e) => onFilterChange?.(f.key, e.target.value || null)}
                          className="h-9 w-full appearance-none rounded-md border border-gray-300 bg-white pl-3 pr-8 text-sm focus:border-violet-400 focus:outline-none"
                        >
                          <option value="">{t("Any")}</option>
                          {f.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>{t(opt.label)}</option>
                          ))}
                        </select>
                        {filterValues[f.key] ? (
                          <button
                            onClick={() => onFilterChange?.(f.key, null)}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                          >
                            <X size={13} />
                          </button>
                        ) : (
                          <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {typeOptions && (
        <Modal
          open={pickingType}
          onClose={() => setPickingType(false)}
          title={t(typeFacetLabel)}
          maxWidth="max-w-md"
          footer={
            <button onClick={() => setPickingType(false)} className="rounded-md h-9 px-3 text-sm text-gray-500 hover:bg-gray-100">{t("Cancel")}</button>
          }
        >
          <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto">
            {[{ value: null, label: "Any", icon: null }, ...typeOptions].map((opt) => {
              const Icon = opt.value === null ? ListFilter : typeIcon(opt.icon);
              const active = (typeValue ?? null) === opt.value;
              return (
                <button
                  key={opt.value ?? "any"}
                  type="button"
                  onClick={() => { onTypeChange?.(opt.value); setPickingType(false); }}
                  aria-pressed={active}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm ${
                    active ? "border-gray-700 bg-gray-100 text-gray-900" : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon size={15} className="shrink-0" style={opt.color ? { color: opt.color } : undefined} />
                  <span className="truncate">{t(opt.label)}</span>
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip}
              className="flex items-center gap-1 rounded-full border border-dashed border-gray-300 h-8 px-2.5 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700"
            >
              <Plus size={12} />
              {t(chip)}
            </button>
          ))}
        </div>
      )}

      {sortLabel && (
        <button
          onClick={onSortClick}
          className="flex items-center gap-1.5 rounded-md h-7 px-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          <ArrowUpDown size={13} />
          {t("Sort by")}
          <span className="text-gray-900">{t(sortLabel)}</span>
          <ChevronDown size={12} />
        </button>
      )}
    </div>
  );
}
