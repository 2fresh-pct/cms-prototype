import { useParams } from "react-router-dom";
import { useLocalStorage } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import {
  seedEntries, seedContentTypes, seedUsers, seedTaxonomies, seedMedia, DEFAULT_WORKFLOW_STEPS, normalizeWorkflowSteps,
  DEFAULT_CHANNELS, normalizeChannels,
} from "../lib/seed";
import { Fragment } from "react";
import FieldView, { isEmpty } from "../components/FieldView";
import { holdsSeveral } from "../lib/media";
import { Signal, Wifi, BatteryFull, ChevronLeft } from "lucide-react";

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
  const shown = extra.filter((f) => !isEmpty(entry.fieldValues?.[f.name]));
  const hasBody = !isEmpty(entry.body);
  const h = compact ? "text-[11px]" : "text-xs";

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {bodyField || !type ? (
        hasBody
          ? <FieldView field={{ type: "Rich text" }} value={entry.body} ctx={ctx} compact={compact} />
          : <p className="italic text-gray-400">{t("No body content yet.")}</p>
      ) : null}
      {shown.map((f, i) => (
        <Fragment key={f.name}>
          {f.group && f.group !== shown[i - 1]?.group && (
            <h2 className={`border-t border-gray-200 pt-5 font-semibold text-gray-900 ${compact ? "text-base" : "text-xl"}`}>{t(f.group)}</h2>
          )}
          <div>
            {f.type !== "Sections" && !(f.type === "Media" && !holdsSeveral(f)) && (
              <p className={`mb-1.5 font-medium uppercase tracking-wide text-gray-400 ${h}`}>{t(f.label ?? f.name)}</p>
            )}
            <FieldView field={f} value={entry.fieldValues?.[f.name]} ctx={ctx} compact={compact} />
          </div>
        </Fragment>
      ))}
    </div>
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
  const ctx = { taxonomies, media, entries, contentTypes };

  return channel.icon === "smartphone" ? (
    <AppMock entry={entry} channel={channel} isPublished={isPublished} typeName={type ? t(type.name) : ""} type={type} ctx={ctx} />
  ) : (
    <WebsiteMock entry={entry} channel={channel} isPublished={isPublished} author={author} typeName={type ? t(type.name) : ""} type={type} ctx={ctx} />
  );
}
