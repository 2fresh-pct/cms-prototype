import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Trash2, ArrowUp, ArrowDown, FolderPlus } from "lucide-react";
import { useLocalStorage } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { seedTaxonomies, updateTermInTree, addTermToTree, removeTermFromTree, moveTermInTree, countTerms, countTranslated, LOCALE_LIST, LOCALE_NAMES } from "../lib/seed";
import PageHeader from "../components/PageHeader";
import DetailField from "../components/DetailField";
import SegmentedControl from "../components/SegmentedControl";

function newTermId() {
  return `term-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// `locale` is the language whose names are being edited. In the default language that
// is the term's own name; in another it is a translation, and until one is entered the
// default name shows as a hint.
function TermRow({ term, depth, index, siblingCount, locale, baseLocale, onRename, onAddChild, onRemove, onMove }) {
  const { t } = useI18n();
  const isBase = locale === baseLocale;
  return (
    <div>
      <div className="flex items-center gap-1.5 py-1" style={{ paddingLeft: depth * 24 }}>
        <input
          value={isBase ? term.name : term.names?.[locale] ?? ""}
          onChange={(e) => onRename(term.id, e.target.value)}
          placeholder={isBase ? undefined : term.name}
          aria-label={`${t(LOCALE_NAMES[locale])}: ${term.name}`}
          className="flex-1 rounded-md border border-gray-300 bg-white h-8 px-2.5 text-sm placeholder:italic placeholder:text-gray-400 focus:border-violet-400 focus:outline-none"
        />
        <button
          onClick={() => onAddChild(term.id)}
          title={t("Add sub-term")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-violet-600"
        >
          <FolderPlus size={14} />
        </button>
        <button
          onClick={() => onMove(term.id, -1)}
          disabled={index === 0}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
        >
          <ArrowUp size={14} />
        </button>
        <button
          onClick={() => onMove(term.id, 1)}
          disabled={index === siblingCount - 1}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
        >
          <ArrowDown size={14} />
        </button>
        <button
          onClick={() => onRemove(term.id)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-red-600"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {term.children.map((child, i) => (
        <TermRow
          key={child.id}
          term={child}
          depth={depth + 1}
          index={i}
          siblingCount={term.children.length}
          locale={locale}
          baseLocale={baseLocale}
          onRename={onRename}
          onAddChild={onAddChild}
          onRemove={onRemove}
          onMove={onMove}
        />
      ))}
    </div>
  );
}

export default function TaxonomyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [taxonomies, setTaxonomies] = useLocalStorage("cms.taxonomies", seedTaxonomies);
  const [baseLocale] = useLocalStorage("cms.settings.defaultLocale", "en");
  // The language whose names are shown and edited. Structure (adding, moving, deleting)
  // is the same in every language.
  const [locale, setLocale] = useState(baseLocale);

  const taxonomy = taxonomies.find((tx) => tx.id === id);
  const [name, setName] = useState(taxonomy?.name ?? "");
  const [saveStatus, setSaveStatus] = useState("saved");
  const saveTimeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(saveTimeoutRef.current), []);

  if (!taxonomy) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">{t("Taxonomy not found.")}</p>
        <button onClick={() => navigate("/taxonomies")} className="mt-2 text-sm font-medium text-violet-600 hover:text-violet-700">
          {t("Back to Taxonomies")}
        </button>
      </div>
    );
  }

  function update(patch) {
    setTaxonomies(taxonomies.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)));
    setSaveStatus("saving");
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaveStatus("saved"), 600);
  }

  function renameTerm(termId, newName) {
    if (locale === baseLocale) {
      update({ terms: updateTermInTree(taxonomy.terms, termId, { name: newName }) });
      return;
    }
    // A translation; clearing it removes it, so the default name is used again.
    update({
      terms: updateTermInTree(taxonomy.terms, termId, (term) => {
        const names = { ...(term.names ?? {}) };
        if (newName.trim()) names[locale] = newName;
        else delete names[locale];
        return { names };
      }),
    });
  }

  function addChildTerm(parentId) {
    update({ terms: addTermToTree(taxonomy.terms, parentId, { id: newTermId(), name: t("New term"), children: [] }) });
  }

  function addRootTerm() {
    update({ terms: addTermToTree(taxonomy.terms, null, { id: newTermId(), name: t("New term"), children: [] }) });
  }

  function removeTerm(termId) {
    update({ terms: removeTermFromTree(taxonomy.terms, termId) });
  }

  function moveTerm(termId, dir) {
    update({ terms: moveTermInTree(taxonomy.terms, termId, dir) });
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <PageHeader crumbs={["Taxonomies", name || taxonomy.name]} onBack={() => navigate(-1)} saveStatus={saveStatus} />

      <div className="max-w-2xl space-y-5 rounded-lg border border-gray-300 bg-white p-5">
        <DetailField label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => update({ name: name.trim() || taxonomy.name })}
            className="w-full rounded-md border border-gray-300 bg-white h-9 px-3 text-sm focus:border-violet-400 focus:outline-none"
          />
        </DetailField>

        <DetailField label="Description">
          <input
            value={taxonomy.description ?? ""}
            onChange={(e) => update({ description: e.target.value })}
            placeholder={t("What is this taxonomy used for?")}
            className="w-full rounded-md border border-gray-300 bg-white h-9 px-3 text-sm focus:border-violet-400 focus:outline-none"
          />
        </DetailField>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wide text-gray-400">{t("Terms")}</label>
            <button onClick={addRootTerm} className="flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Plus size={14} /> {t("Add term")}
            </button>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <SegmentedControl
              options={LOCALE_LIST.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))}
              value={locale}
              onChange={setLocale}
            />
            <span className="text-xs text-gray-500">
              {locale === baseLocale
                ? t("Default language")
                : t("{done} of {total} translated", { done: countTranslated(taxonomy.terms, locale), total: countTerms(taxonomy.terms) })}
            </span>
          </div>
          <div className="space-y-1 rounded-md border border-gray-300 bg-white p-3">
            {taxonomy.terms.map((tm, i) => (
              <TermRow
                key={tm.id}
                term={tm}
                depth={0}
                index={i}
                siblingCount={taxonomy.terms.length}
                locale={locale}
                baseLocale={baseLocale}
                onRename={renameTerm}
                onAddChild={addChildTerm}
                onRemove={removeTerm}
                onMove={moveTerm}
              />
            ))}
            {taxonomy.terms.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-400">{t("No terms yet.")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
