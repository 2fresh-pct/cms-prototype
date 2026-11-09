import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, Plus, ChevronDown, ArrowUpDown, X, ListFilter, Check } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { typeIcon } from "../lib/typeIcons";

// `typeFacetLabel` / `typeLabel` show the type chip next to the search box. With
// `typeOptions` ([{ value, label, icon?, color? }]), `typeValue` and `onTypeChange`
// the chip opens a small menu just under it to pick the type (or Any), applied
// right away.
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
  const typeRef = useRef(null);

  useEffect(() => {
    if (!pickingType) return;
    const onDown = (e) => { if (typeRef.current && !typeRef.current.contains(e.target)) setPickingType(false); };
    const onKey = (e) => { if (e.key === "Escape") setPickingType(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickingType]);

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
          <div className="relative" ref={typeRef}>
            <button
              type="button"
              onClick={() => typeOptions && setPickingType((v) => !v)}
              aria-haspopup={typeOptions ? "menu" : undefined}
              aria-expanded={typeOptions ? pickingType : undefined}
              className="flex items-center gap-1.5 rounded-md bg-gray-100 h-8 px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              {t(typeFacetLabel)}
              <span className="rounded bg-white px-1.5 py-0.5 text-gray-900 ring-1 ring-gray-300">{t(typeLabel ?? "Any")}</span>
              {typeOptions && <ChevronDown size={12} className={`transition-transform ${pickingType ? "rotate-180" : ""}`} />}
            </button>

            {typeOptions && pickingType && (
              <div role="menu" className="absolute left-0 top-full z-20 mt-2 max-h-80 w-64 overflow-y-auto rounded-lg border border-gray-300 bg-white p-1 wf-pop">
                {[{ value: null, label: "Any", icon: null }, ...typeOptions].map((opt) => {
                  const Icon = opt.value === null ? ListFilter : typeIcon(opt.icon);
                  const active = (typeValue ?? null) === opt.value;
                  return (
                    <button
                      key={opt.value ?? "any"}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => { onTypeChange?.(opt.value); setPickingType(false); }}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm ${
                        active ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <Icon size={15} className="shrink-0 text-gray-500" style={opt.color ? { color: opt.color } : undefined} />
                      <span className="flex-1 truncate">{t(opt.label)}</span>
                      {active && <Check size={14} className="shrink-0 text-gray-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
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
              <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-lg border border-gray-300 bg-white p-3 wf-pop">
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
                          className="no-chevron h-9 w-full rounded-md border border-gray-300 bg-white pl-3 pr-8 text-sm focus:border-violet-400 focus:outline-none"
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
        <div className="flex flex-1 items-center gap-2 px-1">
          <Search size={14} className="text-gray-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("Type to search for entries")}
            className="w-full bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
          />
        </div>

      </div>

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
