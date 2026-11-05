import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLocalStorage } from "../lib/storage";
import { seedCatalogueItems, seedCatalogueCategories, getUser, STATUS_LIST, LOCALE_LIST } from "../lib/seed";
import PageHeader from "../components/PageHeader";
import DetailField from "../components/DetailField";
import StatusPill from "../components/StatusPill";
import Avatar from "../components/Avatar";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function CatalogueItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useLocalStorage("cms.catalogueItems", seedCatalogueItems);
  const [categories] = useLocalStorage("cms.catalogueCategories", seedCatalogueCategories);

  const item = items.find((i) => i.id === id);
  const [name, setName] = useState(item?.name ?? "");
  const [saveStatus, setSaveStatus] = useState("saved");
  const saveTimeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(saveTimeoutRef.current), []);

  if (!item) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Item not found.</p>
        <button onClick={() => navigate("/catalogue")} className="mt-2 text-sm font-medium text-violet-600 hover:text-violet-700">
          Back to Catalogue
        </button>
      </div>
    );
  }

  const category = categories.find((c) => c.id === item.categoryId);
  const author = getUser(item.authorId);

  function update(patch) {
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    setSaveStatus("saving");
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaveStatus("saved"), 600);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <PageHeader crumbs={["Catalogue", category?.name, name || item.name]} onBack={() => navigate(-1)} saveStatus={saveStatus} />

      <div className="flex gap-6">
        <div className="flex-1 space-y-5 rounded-lg border border-gray-300 bg-white p-5">
          <DetailField label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => update({ name: name.trim() || item.name })}
              className="w-full rounded-md border border-gray-300 bg-white h-9 px-3 text-sm focus:border-violet-400 focus:outline-none"
            />
          </DetailField>
          <DetailField label="URL">
            <input
              value={item.url}
              onChange={(e) => update({ url: e.target.value })}
              className="w-full rounded-md border border-gray-300 bg-white h-9 px-3 text-sm focus:border-violet-400 focus:outline-none"
            />
          </DetailField>
          <DetailField label="Locale">
            <select
              value={item.locale}
              onChange={(e) => update({ locale: e.target.value })}
              className="rounded-md border border-gray-300 bg-white h-9 px-3 text-sm uppercase"
            >
              {LOCALE_LIST.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </DetailField>
        </div>

        <div className="w-72 shrink-0 space-y-5 rounded-lg border border-gray-300 bg-white p-5">
          <DetailField label="Status">
            <select
              value={item.status}
              onChange={(e) => update({ status: e.target.value })}
              className="w-full rounded-md border border-gray-300 bg-white h-9 px-3 text-sm"
            >
              {STATUS_LIST.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="mt-2">
              <StatusPill status={item.status} />
            </div>
          </DetailField>
          <DetailField label="Category">
            <span className="text-sm text-gray-700">{category?.name}</span>
          </DetailField>
          <DetailField label="Modified">
            <span className="text-sm text-gray-500">{formatDate(item.updatedAt)}</span>
          </DetailField>
          <DetailField label="Last reviewed">
            <span className="text-sm text-gray-500">{formatDate(item.lastReviewedAt)}</span>
          </DetailField>
          <DetailField label="Author">
            <span className="inline-flex items-center gap-2">
              <Avatar user={author} size={20} />
              <span className="text-sm text-gray-700">{author?.email}</span>
            </span>
          </DetailField>
        </div>
      </div>
    </div>
  );
}
