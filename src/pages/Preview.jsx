import { useParams } from "react-router-dom";
import { useLocalStorage } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import {
  seedEntries, seedContentTypes, seedUsers, seedTaxonomies, seedMedia, DEFAULT_WORKFLOW_STEPS, normalizeWorkflowSteps,
  DEFAULT_CHANNELS, normalizeChannels,
} from "../lib/seed";
import { Fragment } from "react";
import FieldView, { isEmpty } from "../components/FieldView";
import MediaThumb from "../components/MediaThumb";
import { inLocale } from "../components/ContentItemEmbed";
import { holdsSeveral, mediaIds } from "../lib/media";
import { sectionsOf, groupsOf } from "../lib/groups";
import { htmlToText } from "../lib/richtext";
import { Signal, Wifi, BatteryFull, ChevronLeft, ChevronDown } from "lucide-react";

function DraftBanner({ compact }) {
  const { t } = useI18n();
  return (
    <div className={`bg-amber-400 text-center font-medium text-amber-950 ${compact ? "px-4 py-1 text-[11px]" : "px-4 py-1.5 text-xs"}`}>
      {compact ? t("Preview only — not published") : t("Preview only — not published yet")}
    </div>
  );
}

// Everything the entry holds, in the content type's field order: the core
// title/slug/body slots first, then the remaining fields that have a value,
// grouped by the field's `group`.
function EntryFields({ entry, type, ctx, compact }) {
  const { t } = useI18n();
  const fields = type?.fields ?? [];
  const bodyField = fields.find((f) => f.core === "body") ?? fields.find((f) => f.name === "body");
  const extra = fields.filter((f) => !f.core && !["title", "slug", "body"].includes(f.name));
  // A type without tabs lists its fields in the type's order, so those before the body
  // (a subtitle) come before it; a type with tabs keeps them after it.
  const bodyIndex = bodyField ? fields.indexOf(bodyField) : -1;
  const hasTabs = sectionsOf(type, extra).length > 1;
  const isTop = (f) => !hasTabs && bodyIndex > -1 && fields.indexOf(f) < bodyIndex;
  const filled = extra.filter((f) => !isEmpty(entry.fieldValues?.[f.name]));
  const top = filled.filter(isTop);
  const shown = filled.filter((f) => !isTop(f));
  const hasBody = !isEmpty(entry.body);
  // With tabs the body sits among the fields of its own group, in the type's order.
  const bodyGroup = bodyField?.group && groupsOf(type).includes(bodyField.group) ? bodyField.group : null;
  const bodyInList = Boolean(bodyField && hasTabs && sectionsOf(type, extra).some((sec) => (sec.name ?? null) === bodyGroup));
  const sequence = bodyInList
    ? [...shown, bodyField].sort((a, b) => fields.indexOf(a) - fields.indexOf(b))
    : shown;
  const bodyBlock = hasBody
    ? <FieldView field={{ type: "Rich text" }} value={entry.body} ctx={ctx} compact={compact} />
    : <p className="italic text-gray-400">{t("No body content yet.")}</p>;
  const h = compact ? "text-[11px]" : "text-xs";

  const field = (f) => (
    <div key={f.name}>
      {f.type !== "Sections" && !(f.type === "Media" && !holdsSeveral(f)) && (
        <p className={`mb-1.5 font-medium uppercase tracking-wide text-gray-400 ${h}`}>{t(f.label ?? f.name)}</p>
      )}
      <FieldView field={f} value={entry.fieldValues?.[f.name]} ctx={ctx} compact={compact} />
    </div>
  );

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {top.map(field)}
      {(bodyField || !type) && !bodyInList ? bodyBlock : null}
      {sequence.map((f, i) => (
        <Fragment key={f.name}>
          {f.group && f.group !== sequence[i - 1]?.group && (
            <h2 className={`border-t border-gray-200 pt-5 font-semibold text-gray-900 ${compact ? "text-base" : "text-xl"}`}>{t(f.group)}</h2>
          )}
          {f === bodyField ? bodyBlock : (
          <div>
            {f.type !== "Sections" && !(f.type === "Media" && !holdsSeveral(f)) && (
              <p className={`mb-1.5 font-medium uppercase tracking-wide text-gray-400 ${h}`}>{t(f.label ?? f.name)}</p>
            )}
            <FieldView field={f} value={entry.fieldValues?.[f.name]} ctx={ctx} compact={compact} />
          </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}

// A content item linked from the entry (a Reference field or an embedded item), shown
// with its real content, as a website or app would get it when the API includes
// linked items one level deep: its image, title and summary, and all its fields behind
// "Show all content". Items inside it are not expanded again.
function LinkedEntry({ entry, ctx, compact }) {
  const { t } = useI18n();
  const type = ctx.contentTypes.find((ct) => ct.id === entry.contentTypeId);
  const fields = type?.fields ?? [];
  const values = entry.fieldValues ?? {};

  const mediaField = fields.find((f) => (f.type === "Media" || f.type === "Media list") && mediaIds(values[f.name]).length > 0);
  const image = mediaField ? ctx.media.find((m) => m.id === mediaIds(values[mediaField.name])[0]) : null;

  const summaryField = fields.find((f) => /summary|perex|excerpt/i.test(f.name) && !isEmpty(values[f.name]));
  const raw = summaryField ? values[summaryField.name] : htmlToText(entry.body);
  const summary = typeof raw === "string" ? (htmlToText(raw) || raw) : "";
  const short = summary.length > 220 ? `${summary.slice(0, 217).trimEnd()}…` : summary;

  // One level only: references inside it fall back to the plain list.
  const inner = { ...ctx, linked: null };
  return (
    <article className="overflow-hidden rounded-md border border-gray-300">
      {image && <MediaThumb item={image} className={`w-full border-b border-gray-300 ${compact ? "aspect-[16/9]" : "aspect-[21/9]"}`} />}
      <div className={compact ? "space-y-1.5 px-3 py-2.5" : "space-y-2 px-4 py-3"}>
        <p className={`font-medium uppercase tracking-wide text-gray-400 ${compact ? "text-[10px]" : "text-xs"}`}>{type ? t(type.name) : ""}</p>
        <h3 className={`font-semibold text-gray-900 ${compact ? "text-sm" : "text-lg"}`}>{entry.title}</h3>
        {short && <p className={`text-gray-600 ${compact ? "text-xs" : "text-sm"}`}>{short}</p>}
        <details className="group pt-1">
          <summary className={`flex cursor-pointer list-none items-center gap-1 font-medium text-gray-500 hover:text-gray-800 ${compact ? "text-[11px]" : "text-xs"}`}>
            <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
            {t("Show all content")}
          </summary>
          <div className="mt-3 border-t border-gray-200 pt-4">
            <EntryFields entry={entry} type={type} ctx={inner} compact />
          </div>
        </details>
      </div>
    </article>
  );
}

function WebsiteMock({ entry, channel, isPublished, author, typeName, type, ctx }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {!isPublished && <DraftBanner />}
      <header className="flex items-center justify-between border-b border-gray-300 px-6 py-4">
        <span className="font-mono text-lg font-semibold">{channel.name}</span>
        <nav className="flex gap-5 text-sm text-gray-500">
          <span>{t("Home")}</span>
          <span>{t("Explore")}</span>
          <span>{t("Events")}</span>
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">{typeName}</p>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight">{entry.title}</h1>
        <p className="mb-8 text-sm text-gray-400">
          {t("By {name}", { name: author?.name })} · {entry.locale?.toUpperCase()}
        </p>
        <EntryFields entry={entry} type={type} ctx={ctx} />
      </main>
      <footer className="border-t border-gray-100 px-6 py-6 text-center text-xs text-gray-400">
        © 2026 {channel.name}
      </footer>
    </div>
  );
}

function AppMock({ entry, channel, isPublished, typeName, type, ctx }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-8">
      <div className="flex h-[852px] w-[393px] flex-col overflow-hidden rounded-[2.5rem] border-8 border-gray-900 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between bg-gray-900 px-5 py-1.5 text-[10px] text-white">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <Signal size={10} /> <Wifi size={10} /> <BatteryFull size={12} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-3">
          <ChevronLeft size={18} className="text-gray-400" />
          <span className="text-sm font-semibold">{channel.name}</span>
        </div>
        {!isPublished && <DraftBanner compact />}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">{typeName}</p>
          <h1 className="mb-3 text-xl font-semibold leading-snug">{entry.title}</h1>
          <EntryFields entry={entry} type={type} ctx={ctx} compact />
        </div>
      </div>
    </div>
  );
}

export default function Preview() {
  const { t } = useI18n();
  const { channelId, entryId } = useParams();
  const [entries] = useLocalStorage("cms.entries", seedEntries);
  const [contentTypes] = useLocalStorage("cms.contentTypes", seedContentTypes);
  const [taxonomies] = useLocalStorage("cms.taxonomies", seedTaxonomies);
  const [media] = useLocalStorage("cms.media", seedMedia);
  const [rawWorkflowSteps] = useLocalStorage("cms.settings.workflowSteps", DEFAULT_WORKFLOW_STEPS);
  const workflowSteps = normalizeWorkflowSteps(rawWorkflowSteps);
  const [rawChannels] = useLocalStorage("cms.settings.channels", DEFAULT_CHANNELS);
  const channels = normalizeChannels(rawChannels);
  const users = seedUsers();

  const entry = entries.find((e) => e.id === entryId);
  const channel = channels.find((c) => c.id === channelId) ?? channels[0];

  if (!entry || !channel) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">
        {t("Nothing to preview.")}
      </div>
    );
  }

  const type = contentTypes.find((ct) => ct.id === entry.contentTypeId);
  const author = users.find((u) => u.id === entry.updatedBy);
  const publishStepId = workflowSteps[workflowSteps.length - 1]?.id;
  const isPublished = entry.status === publishStepId;
  const ctx = { taxonomies, media, entries, contentTypes, publishStepId, locale: entry.locale, plain: true };
  // Linked items come out as they would live: in the language of this entry when it
  // has a version in it, and only if published (the others are left out).
  ctx.linked = {
    resolve: (e) => {
      const local = inLocale(e, entries, entry.locale);
      return [local, e].find((x) => x && x.status === publishStepId) ?? null;
    },
    render: (e, compact) => <LinkedEntry entry={e} ctx={ctx} compact={compact} />,
  };

  return channel.icon === "smartphone" ? (
    <AppMock entry={entry} channel={channel} isPublished={isPublished} typeName={type ? t(type.name) : ""} type={type} ctx={ctx} />
  ) : (
    <WebsiteMock entry={entry} channel={channel} isPublished={isPublished} author={author} typeName={type ? t(type.name) : ""} type={type} ctx={ctx} />
  );
}
