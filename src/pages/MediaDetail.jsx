import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLocalStorage } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { seedContentTypes, seedEntries, seedMedia, seedUsers, LOCALE_LIST, LOCALE_LABELS, LOCALE_NAMES } from "../lib/seed";
import PageHeader from "../components/PageHeader";
import DetailField from "../components/DetailField";
import MediaThumb from "../components/MediaThumb";
import Avatar from "../components/Avatar";

const formatSize = (kb) => (kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

export default function MediaDetail() {
  const { id } = useParams();
  // Keyed so each file starts from its own saved alt texts.
  return <MediaEditor key={id} id={id} />;
}

function MediaEditor({ id }) {
  const navigate = useNavigate();
  const { t, dateLocale } = useI18n();
  const [media, setMedia] = useLocalStorage("cms.media", seedMedia);
  const [entries] = useLocalStorage("cms.entries", seedEntries);
  const [contentTypes] = useLocalStorage("cms.contentTypes", seedContentTypes);
  const [defaultLocale] = useLocalStorage("cms.settings.defaultLocale", "en");
  const item = media.find((m) => m.id === id);

  // Alt text per language, edited as a draft and saved when a field loses focus.
  const [draft, setDraft] = useState(() => ({ ...(item?.alt ?? {}) }));
  const [justSaved, setJustSaved] = useState(false);

  if (!item) {
    return (
      <div className="flex-1 p-6">
        <PageHeader crumbs={["Media library", "File not found"]} onBack={() => navigate("/media")} />
        <p className="text-sm text-gray-500">{t("This file doesn't exist any more.")}</p>
      </div>
    );
  }

  const saved = item.alt ?? {};
  const dirty = LOCALE_LIST.some((l) => (draft[l] ?? "").trim() !== (saved[l] ?? ""));

  function commit(locale) {
    const value = (draft[locale] ?? "").trim();
    if (value === (saved[locale] ?? "")) return;
    setMedia(media.map((m) => (m.id === id ? { ...m, alt: { ...m.alt, [locale]: value } } : m)));
    setJustSaved(true);
  }

  // Entries that use this file in a media field or as an image in rich text.
  const usedIn = entries.filter((e) => {
    const haystack = JSON.stringify(e.fieldValues ?? {}).replace(/\\"/g, '"') + (e.body ?? "");
    return haystack.includes(`"${id}"`);
  });
  const typeName = (e) => contentTypes.find((ct) => ct.id === e.contentTypeId)?.name ?? "";
  const uploader = seedUsers().find((u) => u.id === item.uploadedBy);
  const date = new Date(item.updatedAt).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit", year: "numeric" });
  const orderedLocales = [defaultLocale, ...LOCALE_LIST.filter((l) => l !== defaultLocale)].filter((l) => LOCALE_LIST.includes(l));

  return (
    <div className="flex min-h-0 flex-1 flex-col p-6">
      <PageHeader
        crumbs={["Media library", item.name]}
        onBack={() => navigate("/media")}
        saveStatus={dirty ? "unsaved" : justSaved ? "saved" : null}
      />

      {/* The preview and the details scroll independently, like the entry page. */}
      <div className="flex min-h-0 flex-1 gap-6">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-auto rounded-lg border border-gray-300 bg-white p-5">
          {item.src ? (
            <img
              src={item.src}
              alt={saved[defaultLocale] || item.name}
              className="max-h-full max-w-full rounded-md border border-gray-300 object-contain"
            />
          ) : (
            <MediaThumb item={item} className="aspect-video w-full max-w-2xl rounded-md border border-gray-300" />
          )}
          <p className="text-xs text-gray-400">
            {item.src
              ? item.width
                ? t("Preview copy of the original ({w} × {h} px)", { w: item.width, h: item.height })
                : t("Preview copy of the original")
              : t("Sample file: no picture to show.")}
          </p>
        </div>

        <div className="max-h-full w-96 shrink-0 space-y-5 self-start overflow-y-auto rounded-lg border border-gray-300 bg-white p-5">
          <div>
            <h2 className="mb-1 text-sm font-semibold text-gray-900">{t("Alt text")}</h2>
            <p className="mb-3 text-xs text-gray-500">
              {t("Describes the image for screen readers. Used when the image is inserted into rich text, in the language of the entry.")}
            </p>
            <div className="space-y-3">
              {orderedLocales.map((locale) => (
                <div key={locale}>
                  <label htmlFor={`alt-${locale}`} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">{LOCALE_LABELS[locale]}</span>
                    {t(LOCALE_NAMES[locale])}
                    {locale === defaultLocale && <span className="normal-case tracking-normal">· {t("Default language")}</span>}
                  </label>
                  <textarea
                    id={`alt-${locale}`}
                    rows={2}
                    value={draft[locale] ?? ""}
                    onChange={(e) => { setJustSaved(false); setDraft({ ...draft, [locale]: e.target.value }); }}
                    onBlur={() => commit(locale)}
                    className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 border-t border-gray-200 pt-5">
            <DetailField label="File name"><span className="break-all text-sm text-gray-700">{item.name}</span></DetailField>
            <DetailField label="Type"><span className="text-sm text-gray-700">{item.kind}</span></DetailField>
            <DetailField label="Size"><span className="text-sm text-gray-700">{formatSize(item.sizeKb)}</span></DetailField>
            {item.width && (
              <DetailField label="Dimensions"><span className="text-sm text-gray-700">{item.width} × {item.height} px</span></DetailField>
            )}
            <DetailField label="Uploaded"><span className="text-sm text-gray-700">{date}</span></DetailField>
            {uploader && (
              <DetailField label="Uploaded by">
                <span className="inline-flex items-center gap-2 text-sm text-gray-700"><Avatar user={uploader} size={20} />{uploader.name}</span>
              </DetailField>
            )}
          </div>

          <div className="border-t border-gray-200 pt-5">
            <DetailField label="Used in">
              {usedIn.length === 0 ? (
                <p className="text-sm text-gray-400">{t("Not used anywhere yet.")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {usedIn.slice(0, 8).map((e) => (
                    <li key={e.id} className="text-sm">
                      <Link to={`/content/${e.id}`} className="font-medium text-gray-900 underline-offset-2 hover:underline">{e.title}</Link>
                      <span className="text-gray-400"> · {t(typeName(e))}{e.locale ? ` · ${LOCALE_LABELS[e.locale] ?? e.locale}` : ""}</span>
                    </li>
                  ))}
                  {usedIn.length > 8 && <li className="text-xs text-gray-400">{t("and {n} more", { n: usedIn.length - 8 })}</li>}
                </ul>
              )}
            </DetailField>
          </div>
        </div>
      </div>
    </div>
  );
}
