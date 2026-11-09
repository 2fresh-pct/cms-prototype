import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Smartphone, Globe, Radio, Tv, Mail, MessageSquare, Clock, History, ArrowLeft, MessageCircle, X, Languages, Send, FilePlus, Lock } from "lucide-react";
import { useLocalStorage } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import {
  seedEntries, seedContentTypes, seedUsers, seedTaxonomies, seedMedia, LOCALE_LIST, LOCALE_LABELS, LOCALE_NAMES, normalizeEntryGroupId,
  DEFAULT_WORKFLOW_STEPS, normalizeWorkflowSteps, normalizeEntryStatus,
  DEFAULT_CHANNELS, normalizeChannels, ALL_CHANNELS, isAllChannels, resolvePublishedChannelIds,
} from "../lib/seed";
import PageHeader from "../components/PageHeader";
import DetailField from "../components/DetailField";
import FieldEditor from "../components/FieldEditor";
import FieldView, { isEmpty, FieldSeparator } from "../components/FieldView";
import RichTextEditor, { RichTextView } from "../components/RichTextEditor";
import StatusPill from "../components/StatusPill";
import StatusSelect from "../components/StatusSelect";
import Avatar from "../components/Avatar";
import Modal from "../components/Modal";
import GroupTabs from "../components/GroupTabs";
import { slugify, slugOf } from "../lib/slug";
import { GENERAL, sectionsOf } from "../lib/groups";
import PreviewButton from "../components/PreviewButton";
import { useMediaUpload } from "../lib/mediaUpload";

const CHANNEL_ICONS = { smartphone: Smartphone, globe: Globe, radio: Radio, tv: Tv, mail: Mail, "message-square": MessageSquare };

function defaultScheduleValue() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatScheduled(iso, locale = "en-GB") {
  return new Date(iso).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Turns one key of an update() patch into a human-readable history line, or
// null if that key's new value doesn't actually differ from what's on the
// entry already (so blur-without-editing doesn't log a no-op change).
function describeChange(key, value, prevEntry, { workflowSteps, channels, fields }) {
  switch (key) {
    case "title":
      return value !== prevEntry.title ? `Title changed to "${value}"` : null;
    case "body":
      return value !== (prevEntry.body ?? "") ? "Body updated" : null;
    case "slug":
      if ((value || null) === (prevEntry.slug || null)) return null;
      return value ? `Slug changed to "/${value}"` : "Slug reset to follow the title";
    case "status": {
      if (value === prevEntry.status) return null;
      const step = workflowSteps.find((s) => s.id === value);
      return `Status changed to "${step?.name ?? value}"`;
    }
    case "channels": {
      const before = resolvePublishedChannelIds(prevEntry.channels, channels);
      const after = resolvePublishedChannelIds(value, channels);
      if (before.join(",") === after.join(",")) return null;
      if (isAllChannels(value)) return "Channels set to All channels";
      const names = channels.filter((c) => after.includes(c.id)).map((c) => c.name);
      return `Channels set to "${names.join(", ")}"`;
    }
    case "scheduledPublishAt": {
      const prevValue = prevEntry.scheduledPublishAt ?? null;
      if (value === prevValue) return null;
      return value ? `Scheduled to publish on ${formatScheduled(value)}` : "Publish schedule cancelled";
    }
    case "fieldValues": {
      const prevValues = prevEntry.fieldValues ?? {};
      const changed = Object.keys(value).filter((k) => JSON.stringify(value[k]) !== JSON.stringify(prevValues[k]));
      const changedField = fields.find((f) => f.name === changed[0]);
      return changed.length > 0 ? `Field "${changedField?.label ?? changed[0]}" updated` : null;
    }
    default:
      return null;
  }
}

function GroupHeading({ group, prev }) {
  const { t } = useI18n();
  if (!group || group === prev) return null;
  return <h3 className="border-t border-gray-200 pt-5 text-sm font-semibold text-gray-900">{t(group)}</h3>;
}

export default function ContentDetail() {
  const { id } = useParams();
  const { t, dateLocale } = useI18n();
  const fmtDate = (iso) => formatScheduled(iso, dateLocale);
  const navigate = useNavigate();
  const [entries, setEntries] = useLocalStorage("cms.entries", seedEntries);
  const [defaultLocale] = useLocalStorage("cms.settings.defaultLocale", "en");
  const [contentTypes] = useLocalStorage("cms.contentTypes", seedContentTypes);
  const [rawWorkflowSteps] = useLocalStorage("cms.settings.workflowSteps", DEFAULT_WORKFLOW_STEPS);
  const workflowSteps = useMemo(() => normalizeWorkflowSteps(rawWorkflowSteps), [rawWorkflowSteps]);
  const [rawChannels] = useLocalStorage("cms.settings.channels", DEFAULT_CHANNELS);
  const channels = useMemo(() => normalizeChannels(rawChannels), [rawChannels]);
  const [taxonomies] = useLocalStorage("cms.taxonomies", seedTaxonomies);
  const [media, setMedia] = useLocalStorage("cms.media", seedMedia);
  const users = seedUsers();
  const mediaUpload = useMediaUpload({ media, setMedia, userId: users[0]?.id });

  const entry = entries.find((e) => e.id === id);
  const [title, setTitle] = useState(entry?.title ?? "");
  const [saveStatus, setSaveStatus] = useState("saved");
  const saveTimeoutRef = useRef(null);
  const [pendingPublish, setPendingPublish] = useState(false);
  const [pendingUnpublish, setPendingUnpublish] = useState(false);
  const [publishMode, setPublishMode] = useState("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [pendingChannels, setPendingChannels] = useState([]);
  const [pendingVersionIds, setPendingVersionIds] = useState([]);
  const [historyMode, setHistoryMode] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState(null); // null = current live version
  const [commentDraft, setCommentDraft] = useState("");
  const [langDialogOpen, setLangDialogOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(GENERAL);

  useEffect(() => () => clearTimeout(saveTimeoutRef.current), []);

  // Self-heal entries whose status predates the Workflow feature (or names a
  // step that no longer exists), same as the Content list page.
  useEffect(() => {
    if (!entry) return;
    const normalized = normalizeEntryStatus(entry.status, workflowSteps);
    if (normalized !== entry.status) {
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: normalized } : e)));
    }
  }, [entry, workflowSteps, id]);

  // Self-heal entries that predate groupId (language versions were a single
  // field back then) so sibling lookups below always have something to key on.
  useEffect(() => {
    const needsFix = entries.some((e) => !e.groupId);
    if (needsFix) setEntries((prev) => prev.map((e) => ({ ...e, groupId: normalizeEntryGroupId(e) })));
  }, [entries]);

  const publishStepId = workflowSteps[workflowSteps.length - 1]?.id;

  if (!entry) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">{t("Entry not found.")}</p>
        <button onClick={() => navigate("/content")} className="mt-2 text-sm font-medium text-violet-600 hover:text-violet-700">
          {t("Back to All content")}
        </button>
      </div>
    );
  }

  // Applies a patch to one entry and appends a history snapshot if anything
  // really changed. Pure, so several entries can be updated in one write.
  function applyPatch(target, patch, summary) {
    const changeSummaries = summary
      ? [summary]
      : Object.keys(patch)
          .map((key) => describeChange(key, patch[key], target, { workflowSteps, channels, fields: contentTypes.find((c) => c.id === target.contentTypeId)?.fields ?? [] }))
          .filter(Boolean);

    const merged = { ...target, ...patch };
    const { history: _omit, live: _live, ...snapshot } = merged;
    const newHistoryEntry = changeSummaries.length > 0
      ? [{ id: `h${Date.now()}-${target.id}`, timestamp: new Date().toISOString(), userId: users[0]?.id, summary: changeSummaries.join(", "), snapshot }]
      : [];
    return { ...merged, history: [...(target.history ?? []), ...newHistoryEntry] };
  }

  function update(patch) {
    // A published item has no editable instance: only comments can still change.
    if (isPublished && Object.keys(patch).some((k) => k !== "comments")) return;
    setEntries(entries.map((e) => (e.id === id ? applyPatch(e, patch) : e)));
    setSaveStatus("saving");
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaveStatus("saved"), 600);
  }

  function setFieldValue(fieldName, value) {
    update({ fieldValues: { ...(entry.fieldValues ?? {}), [fieldName]: value } });
  }

  // Publishing is where channels get chosen: the dialog opens from the header
  // Publish button, or by moving the entry to the final workflow step.
  function openPublishDialog() {
    setPublishMode("now");
    setScheduledAt(defaultScheduleValue());
    setPendingChannels(publishedChannelIds);
    setPendingVersionIds([entry.id]);
    setPendingPublish(true);
  }

  function togglePendingVersion(versionId) {
    setPendingVersionIds((prev) => (prev.includes(versionId) ? prev.filter((v) => v !== versionId) : [...prev, versionId]));
  }

  function togglePendingChannel(channelId) {
    setPendingChannels((prev) => (prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]));
  }

  // Draft and the steps in between can be picked here; Published is reached
  // only through the Publish dialog.
  function handleStatusChange(value) {
    update({ status: value });
  }

  function flashSaved() {
    setSaveStatus("saving");
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaveStatus("saved"), 600);
  }

  // A published item can't be edited. "Create new draft" starts an editable
  // draft at the first step (same content) while the published version stays
  // live, kept as `live`; publishing the draft replaces it.
  function createDraft() {
    const { history: _h, live: _l, ...content } = entry;
    setEntries(entries.map((e) =>
      e.id === id
        ? applyPatch(e, { status: workflowSteps[0]?.id, scheduledPublishAt: null, live: { ...content, publishedAt: entry.updatedAt } }, "New draft created; the published version stays live")
        : e
    ));
    flashSaved();
  }

  // Takes the live version offline; a published item goes back to an editable
  // draft, a draft that sits over a live version just loses that live version.
  function confirmUnpublish() {
    const patch = isPublished ? { status: workflowSteps[0]?.id, scheduledPublishAt: null, live: null } : { live: null };
    setEntries(entries.map((e) => (e.id === id ? applyPatch(e, patch, "Unpublished") : e)));
    flashSaved();
    setPendingUnpublish(false);
  }

  // Each language version stays its own entry (own status, history, comments):
  // the dialog just applies the same publish action to every ticked version.
  function confirmPublish() {
    if (pendingChannels.length === 0 || pendingVersionIds.length === 0) return;
    const channelsValue = channels.every((c) => pendingChannels.includes(c.id)) ? ALL_CHANNELS : pendingChannels;
    const patch = publishMode === "schedule" && scheduledAt
      ? { scheduledPublishAt: new Date(scheduledAt).toISOString(), channels: channelsValue }
      : { status: publishStepId, scheduledPublishAt: null, channels: channelsValue, live: null };
    setEntries(entries.map((e) => (pendingVersionIds.includes(e.id) ? applyPatch(e, patch) : e)));
    setSaveStatus("saving");
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaveStatus("saved"), 600);
    setPendingPublish(false);
  }

  function addComment() {
    const text = commentDraft.trim();
    if (!text) return;
    const comment = { id: `cm${Date.now()}`, userId: users[0]?.id, text, timestamp: new Date().toISOString() };
    update({ comments: [...(entry.comments ?? []), comment] });
    setCommentDraft("");
  }

  function deleteComment(commentId) {
    update({ comments: (entry.comments ?? []).filter((c) => c.id !== commentId) });
  }

  // A language version is a fully independent entry (own workflow, history,
  // comments), linked to its siblings only by groupId.
  function createTranslation(locale) {
    const newId = `e${Date.now()}`;
    const newEntry = {
      id: newId,
      groupId,
      title: entry.title,
      contentTypeId: entry.contentTypeId,
      status: workflowSteps[0]?.id,
      locale,
      channels: entry.channels,
      updatedAt: new Date().toISOString(),
      updatedBy: users[0]?.id,
    };
    setEntries([
      {
        ...newEntry,
        history: [{ id: `h${Date.now()}`, timestamp: new Date().toISOString(), userId: users[0]?.id, summary: "Entry created", snapshot: newEntry }],
      },
      ...entries,
    ]);
    setLangDialogOpen(false);
    navigate(`/content/${newId}`);
  }

  function openHistory() {
    setHistoryMode(true);
    setSelectedVersionId(null);
  }

  function exitHistory() {
    setHistoryMode(false);
    setSelectedVersionId(null);
  }

  const type = contentTypes.find((t) => t.id === entry.contentTypeId);
  // Fields flagged `core` fill the fixed title / slug / body slots (a POI's name
  // is the entry title, its description the body); everything else is rendered
  // below, grouped by the field's `group`.
  const coreField = (kind) => type?.fields.find((f) => f.core === kind);
  const titleField = coreField("title");
  const slugField = coreField("slug");
  // Types predating `core` name their body field "body"; an unknown type keeps the slot.
  const bodyField = coreField("body") ?? type?.fields.find((f) => f.name === "body");
  const showBody = !type || Boolean(bodyField);
  const extraFields = (type?.fields ?? []).filter((f) => !f.core && !["title", "slug", "body"].includes(f.name));
  // Fields outside the title / slug / body slots are shown in tabs, one per group.
  const sections = sectionsOf(type, extraFields);
  const activeSection = sections.find((s) => (s.name ?? GENERAL) === activeGroup) ?? sections[0];
  const visibleFields = sections.length > 1 ? activeSection.fields : extraFields;
  const groupTabs = sections.length > 1 && (
    <GroupTabs tabs={sections.map((s) => ({ id: s.name ?? GENERAL, label: s.name ?? "General" }))} active={activeSection.name ?? GENERAL} onSelect={setActiveGroup} />
  );
  const singleGroupHeading = sections.length === 1 && sections[0].name ? <GroupHeading group={sections[0].name} /> : null;
  // The slug follows the title until it is edited; typing the title's own slug
  // (or clearing the box) goes back to following it.
  const currentSlug = slugOf(entry);
  const slugTaken = entries.some((e) => e.id !== entry.id && e.locale === entry.locale && slugOf(e) === currentSlug);
  function commitSlug(raw) {
    const next = slugify(raw);
    const follow = !next || next === slugify(entry.title);
    if (follow ? Boolean(entry.slug) : next !== entry.slug) update({ slug: follow ? null : next });
  }
  const fieldCtx = { taxonomies, media, entries, contentTypes, workflowSteps, publishStepId, entryId: entry.id, locale: entry.locale, uploadMedia: mediaUpload.upload };
  const author = users.find((u) => u.id === entry.updatedBy);
  const displayStatus = normalizeEntryStatus(entry.status, workflowSteps);
  const currentStep = workflowSteps.find((s) => s.id === displayStatus);
  const publishedStep = workflowSteps[workflowSteps.length - 1];
  const isPublished = displayStatus === publishStepId;
  // Published content is shown read-only; so is any past version in history.
  const readOnly = historyMode || isPublished;
  const publishedChannelIds = resolvePublishedChannelIds(entry.channels, channels);
  const entryIsAllChannels = isAllChannels(entry.channels);

  const canConfirmPublish =
    pendingChannels.length > 0 && pendingVersionIds.length > 0 && (publishMode !== "schedule" || Boolean(scheduledAt));

  const groupId = normalizeEntryGroupId(entry);
  const siblings = entries.filter((e) => e.id !== entry.id && normalizeEntryGroupId(e) === groupId);

  const history = entry.history ?? [];
  const comments = entry.comments ?? [];
  const selectedVersion = selectedVersionId ? history.find((h) => h.id === selectedVersionId) : null;
  const viewEntry = selectedVersion ? selectedVersion.snapshot : entry;
  const viewStep = workflowSteps.find((s) => s.id === normalizeEntryStatus(viewEntry.status, workflowSteps));
  const viewChannelIds = resolvePublishedChannelIds(viewEntry.channels, channels);
  const viewIsAllChannels = isAllChannels(viewEntry.channels);
  const viewAuthor = users.find((u) => u.id === viewEntry.updatedBy);

  return (
    <div className="flex min-h-0 flex-1 flex-col p-6">
      <PageHeader
        crumbs={["Content", title || entry.title]}
        onBack={() => navigate(-1)}
        saveStatus={saveStatus}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLangDialogOpen(true)}
              className="flex items-center gap-1.5 rounded-md h-9 px-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-200 hover:text-gray-900"
            >
              <Languages size={14} /> {t("Languages")}
              <span className="rounded-full bg-gray-100 px-1.5 text-xs font-normal text-gray-500">
                {siblings.length + 1}/{LOCALE_LIST.length}
              </span>
            </button>
            <PreviewButton
              entryId={entry.id}
              channels={channels}
              defaultChannelId={channels.find((c) => c.icon === "globe")?.id ?? channels[0]?.id}
            />
            {!readOnly && (
              <button
                onClick={openPublishDialog}
                className="flex items-center gap-1.5 rounded-md bg-violet-600 h-9 px-3 text-sm font-medium text-white hover:bg-violet-700"
              >
                <Send size={14} /> {t("Publish")}
              </button>
            )}
          </div>
        }
      />

      {/* The content pane and the side panel scroll independently; the header stays put. */}
      <div className="flex min-h-0 flex-1 gap-6">
        {/* Left column: why the content is read-only (as wide as the content card), then the card. The side panel stays in the same place either way. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {readOnly && (
            <div
              role="status"
              className="mb-4 flex shrink-0 items-start gap-3 rounded-md border border-l-4 border-amber-300 border-l-amber-500 bg-amber-100 px-4 py-3 text-sm font-medium text-amber-950"
            >
              {historyMode ? <History size={18} className="mt-px shrink-0 text-amber-700" /> : <Lock size={18} className="mt-px shrink-0 text-amber-700" />}
              <span>
                {!historyMode
                  ? t("This item is published, so it can't be edited. Create a new draft to make changes; the published version stays live meanwhile.")
                  : selectedVersion
                    ? t("Viewing a read-only past version. Use Back to resume editing.")
                    : t("Viewing a read-only snapshot of the current version. Use Back to resume editing.")}
              </span>
            </div>
          )}
        {readOnly ? (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto rounded-lg border border-gray-300 bg-white p-5">
            <DetailField label={titleField?.label ?? "Title"} required={titleField?.required} localized={titleField?.localized}>
              <p className="text-sm text-gray-900">{viewEntry.title}</p>
            </DetailField>
            <DetailField label="Slug" required={slugField?.required} localized={slugField?.localized}>
              <p className="text-sm text-gray-500">/{slugOf(viewEntry)}</p>
            </DetailField>
            {showBody && (
              <DetailField label={bodyField?.label ?? "Body"} required={bodyField?.required} localized={bodyField?.localized}>
                <RichTextView key={selectedVersionId ?? "current"} value={viewEntry.body} media={media} />
              </DetailField>
            )}
            {groupTabs}
            {singleGroupHeading}
            {visibleFields.map((f) => f.type === "Separator" ? <FieldSeparator key={f.name} /> : (
              <Fragment key={f.name}>
                <DetailField label={f.label ?? f.name} required={f.required} localized={f.localized}>
                  {isEmpty(viewEntry.fieldValues?.[f.name])
                    ? <p className="text-sm text-gray-400">—</p>
                    : <FieldView field={f} value={viewEntry.fieldValues?.[f.name]} ctx={fieldCtx} compact thumbnails />}
                </DetailField>
              </Fragment>
            ))}
            {/* A published item shows these in the side panel; a past version has no such panel, so they go here. */}
            {historyMode && (
              <>
              <DetailField label="Status">
                <StatusPill status={viewStep?.name ?? viewEntry.status} color={viewStep?.color} />
              </DetailField>
              <DetailField label="Channels">
                {viewIsAllChannels ? (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-inset ring-gray-300">
                    {t("All channels")}
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {channels
                      .filter((c) => viewChannelIds.includes(c.id))
                      .map((c) => (
                        <StatusPill key={c.id} status={c.name} color={c.color} />
                      ))}
                  </div>
                )}
              </DetailField>
              <DetailField label="Locale">
                <p className="text-sm uppercase text-gray-700">{viewEntry.locale}</p>
              </DetailField>
              <DetailField label="Last updated by">
                <span className="inline-flex items-center gap-2">
                  <Avatar user={viewAuthor} size={20} />
                  <span className="text-sm text-gray-700">{viewAuthor?.name}</span>
                </span>
              </DetailField>
              </>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto rounded-lg border border-gray-300 bg-white p-5">
            <DetailField label={titleField?.label ?? "Title"} required={titleField?.required} localized={titleField?.localized}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => update({ title: title.trim() || entry.title })}
                className="w-full rounded-md border border-gray-300 bg-[#fff] h-9 px-3 text-sm focus:border-violet-400 focus:outline-none"
              />
            </DetailField>
            <DetailField label="Slug" required={slugField?.required} localized={slugField?.localized}>
              <div className="flex h-9 items-center rounded-md border border-gray-300 bg-[#fff] focus-within:border-violet-400">
                <span className="select-none pl-3 text-sm text-gray-400">/</span>
                {/* Uncontrolled and re-keyed by the value, so a title-driven slug refreshes it. */}
                <input
                  key={`${entry.id}-${currentSlug}`}
                  defaultValue={currentSlug}
                  onBlur={(e) => commitSlug(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  aria-label={t("Slug")}
                  spellCheck={false}
                  className="h-full w-full bg-transparent pl-0.5 pr-3 text-sm text-gray-900 focus:outline-none"
                />
              </div>
              {entry.slug && (
                <button type="button" onClick={() => update({ slug: null })} className="mt-1.5 text-xs font-medium text-violet-600 hover:underline">
                  {t("Reset to follow the title")}
                </button>
              )}
              {slugTaken && <p className="mt-1.5 text-xs text-amber-700">{t("Another item in this language already uses this slug.")}</p>}
            </DetailField>
            {showBody && (
              <DetailField label={bodyField?.label ?? "Body"} required={bodyField?.required} localized={bodyField?.localized}>
                <RichTextEditor
                  key={`${entry.id}-body`}
                  value={entry.body}
                  placeholder={t("Rich text content goes here…")}
                  onChange={(html) => update({ body: html })}
                  minHeight={220}
                media={media}
                onUpload={mediaUpload.upload}
                locale={entry.locale}
                />
              </DetailField>
            )}

            {groupTabs}
            {singleGroupHeading}
            {visibleFields.map((f) => f.type === "Separator" ? <FieldSeparator key={f.name} /> : (
              <Fragment key={f.name}>
                <DetailField label={f.label ?? f.name} required={f.required} localized={f.localized}>
                  <FieldEditor
                    key={`${entry.id}-${f.name}`}
                    field={f}
                    value={entry.fieldValues?.[f.name]}
                    onChange={(value) => setFieldValue(f.name, value)}
                    ctx={fieldCtx}
                  />
                </DetailField>
              </Fragment>
            ))}
          </div>
        )}
        </div>

        {historyMode ? (
          <div className="max-h-full w-80 shrink-0 space-y-3 self-start overflow-y-auto rounded-lg border border-gray-300 bg-white p-5">
            <button
              onClick={exitHistory}
              className="flex w-full items-center justify-center gap-1.5 h-9 rounded-md bg-gray-700 px-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              <ArrowLeft size={15} /> {t("Back")}
            </button>

            <p className="pt-1 text-xs font-medium uppercase tracking-wide text-gray-400">{t("Versions")}</p>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedVersionId(null)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left ${
                  selectedVersionId === null ? "bg-violet-50 ring-1 ring-inset ring-violet-200" : "hover:bg-gray-50"
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Clock size={12} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">{t("Current version")}</span>
                  <span className="block text-xs text-gray-400">{author?.name}</span>
                </span>
              </button>

              {[...history].reverse().map((h) => {
                const changedBy = users.find((u) => u.id === h.userId);
                const active = selectedVersionId === h.id;
                return (
                  <button
                    key={h.id}
                    onClick={() => setSelectedVersionId(h.id)}
                    className={`flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left ${
                      active ? "bg-violet-50 ring-1 ring-inset ring-violet-200" : "hover:bg-gray-50"
                    }`}
                  >
                    <Avatar user={changedBy} size={22} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">{fmtDate(h.timestamp)}</span>
                      <span className="block truncate text-xs text-gray-400">{changedBy?.name}</span>
                    </span>
                  </button>
                );
              })}

              {history.length === 0 && (
                <p className="px-2.5 py-4 text-center text-sm text-gray-400">{t("No earlier versions yet.")}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="max-h-full w-80 shrink-0 space-y-5 self-start overflow-y-auto rounded-lg border border-gray-300 bg-white p-5">
            <DetailField label="Status">
              {isPublished ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={currentStep?.name ?? entry.status} color={currentStep?.color} />
                    <button
                      onClick={() => setPendingUnpublish(true)}
                      className="rounded-md border border-gray-300 bg-white h-7 px-2.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      {t("Unpublish")}
                    </button>
                  </div>
                  <button
                    onClick={createDraft}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-violet-600 h-9 px-3 text-sm font-medium text-white hover:bg-violet-700"
                  >
                    <FilePlus size={14} /> {t("Create new draft")}
                  </button>
                  <p className="mt-2 text-xs text-gray-400">{t("Published content can't be changed. A new draft leaves this version live until you publish the draft.")}</p>
                </>
              ) : (
                <>
                  <StatusSelect
                    value={displayStatus}
                    steps={workflowSteps.slice(0, -1)}
                    onChange={handleStatusChange}
                    fallbackLabel={entry.status}
                  />
                  {entry.live && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-gray-50 px-2.5 py-2 ring-1 ring-inset ring-gray-200">
                      <span className="text-xs text-gray-500">{t("Live version")}</span>
                      <StatusPill status={publishedStep?.name ?? "Published"} color={publishedStep?.color} />
                      <button
                        onClick={() => setPendingUnpublish(true)}
                        className="rounded-md border border-gray-300 bg-white h-7 px-2.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        {t("Unpublish")}
                      </button>
                    </div>
                  )}
                </>
              )}
              {entry.scheduledPublishAt && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                  <Clock size={12} />
                  {t("Scheduled for {when}", { when: fmtDate(entry.scheduledPublishAt) })}
                  <button
                    onClick={() => update({ scheduledPublishAt: null })}
                    className="font-medium text-violet-600 hover:underline"
                  >
                    {t("Cancel")}
                  </button>
                </p>
              )}
            </DetailField>
            <DetailField label="Content type">
              <span className="text-sm text-gray-700">{type ? t(type.name) : ""}</span>
            </DetailField>
            <DetailField label={displayStatus === publishStepId ? "Live on" : "Publishes to"}>
              <div className="flex flex-wrap gap-1.5">
                {entryIsAllChannels ? (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300">
                    {t("All channels")}
                  </span>
                ) : (
                  channels
                    .filter((c) => publishedChannelIds.includes(c.id))
                    .map((c) => {
                      const Icon = CHANNEL_ICONS[c.icon] || Radio;
                      return (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300"
                        >
                          <Icon size={12} />
                          {c.name}
                        </span>
                      );
                    })
                )}
              </div>
              <p className="mt-2 text-xs text-gray-400">{t("Chosen when you publish.")}</p>
            </DetailField>
            <DetailField label="Locale">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium uppercase text-gray-600">
                {entry.locale}
              </span>
              {entry.locale === defaultLocale && (
                <span className="ml-1.5 text-xs text-gray-400">{t("Default language")}</span>
              )}
            </DetailField>
            <DetailField label="Last updated by">
              <span className="inline-flex items-center gap-2">
                <Avatar user={author} size={20} />
                <span className="text-sm text-gray-700">{author?.name}</span>
              </span>
            </DetailField>
            <button
              onClick={openHistory}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white h-9 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <History size={14} /> {t("Version history")}
              {history.length > 0 && (
                <span className="rounded-full bg-gray-100 px-1.5 text-xs font-normal text-gray-500">
                  {history.length}
                </span>
              )}
            </button>

            <div className="border-t border-gray-200 pt-6">
              <p className="mb-4 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                <MessageCircle size={13} /> {t("Comments")}
                {comments.length > 0 && (
                  <span className="rounded-full bg-gray-100 px-1.5 text-[11px] font-normal normal-case text-gray-500">
                    {comments.length}
                  </span>
                )}
              </p>

              <div className="space-y-3">
                {[...comments].reverse().map((c) => {
                  const commenter = users.find((u) => u.id === c.userId);
                  return (
                    <div key={c.id} className="group flex items-start gap-2.5 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="truncate text-sm font-medium text-gray-900">{commenter?.name}</span>
                          <span className="shrink-0 text-xs text-gray-400">{fmtDate(c.timestamp)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{c.text}</p>
                      </div>
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="shrink-0 text-gray-300 opacity-0 hover:text-gray-600 group-hover:opacity-100"
                        title={t("Delete comment")}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
                {comments.length === 0 && <p className="text-sm text-gray-400">{t("No comments yet.")}</p>}
              </div>

              <div className="mt-4 flex items-start gap-2.5">
                <div className="min-w-0 flex-1">
                  <textarea
                    rows={2}
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        addComment();
                      }
                    }}
                    placeholder={t("Leave a comment…")}
                    className="w-full resize-none rounded-md border border-gray-300 bg-[#fff] px-2.5 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={addComment}
                      disabled={!commentDraft.trim()}
                      className="rounded-md bg-violet-600 h-8 px-3 text-xs font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t("Comment")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={langDialogOpen}
        onClose={() => setLangDialogOpen(false)}
        title={t("Languages")}
        footer={
          <button
            onClick={() => setLangDialogOpen(false)}
            className="rounded-md h-9 px-3 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            {t("Close")}
          </button>
        }
      >
        <div className="space-y-2">
          {LOCALE_LIST.map((l) => {
            const isCurrent = l === entry.locale;
            const sibling = isCurrent ? entry : siblings.find((s) => s.locale === l);
            const step = sibling ? workflowSteps.find((s) => s.id === normalizeEntryStatus(sibling.status, workflowSteps)) : null;
            return (
              <div
                key={l}
                className={`flex items-center justify-between rounded-md border px-3 py-2.5 ${
                  isCurrent ? "border-violet-200 bg-violet-50" : "border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-7 shrink-0 text-sm font-semibold text-gray-500">{LOCALE_LABELS[l]}</span>
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                      {t(LOCALE_NAMES[l] ?? l)}
                      {l === defaultLocale && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-500">{t("Default")}</span>
                      )}
                    </p>
                    {sibling ? (
                      <div className="mt-0.5">
                        <StatusPill status={step?.name ?? sibling.status} color={step?.color} />
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">{t("No version in this language yet")}</p>
                    )}
                  </div>
                </div>
                {isCurrent ? (
                  <span className="text-xs font-medium text-violet-600">{t("Current")}</span>
                ) : sibling ? (
                  <button
                    onClick={() => { setLangDialogOpen(false); navigate(`/content/${sibling.id}`); }}
                    className="rounded-md border border-gray-300 bg-white h-8 px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {t("Open")}
                  </button>
                ) : (
                  <button
                    onClick={() => createTranslation(l)}
                    className="rounded-md bg-violet-600 h-8 px-2.5 text-xs font-medium text-white hover:bg-violet-700"
                  >
                    {t("Create")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Modal>

      <Modal
        open={pendingUnpublish}
        onClose={() => setPendingUnpublish(false)}
        title={t('Unpublish "{title}"?', { title: entry.title })}
        footer={
          <>
            <button onClick={() => setPendingUnpublish(false)} className="rounded-md h-9 px-3 text-sm text-gray-500 hover:bg-gray-100">
              {t("Cancel")}
            </button>
            <button onClick={confirmUnpublish} className="rounded-md border border-gray-300 bg-white h-9 px-3 text-sm font-medium text-red-600 hover:bg-red-50">
              {t("Unpublish")}
            </button>
          </>
        }
      >
        {isPublished
          ? t("The published version goes offline and the item becomes an editable draft again.")
          : t("The published version goes offline. The draft you are working on is kept.")}
      </Modal>

      <Modal
        open={pendingPublish}
        onClose={() => setPendingPublish(false)}
        title={t('Publish "{title}"?', { title: entry.title })}
        maxWidth="max-w-md"
        footer={
          <>
            <button
              onClick={() => setPendingPublish(false)}
              className="rounded-md h-9 px-3 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              {t("Cancel")}
            </button>
            <button
              onClick={confirmPublish}
              disabled={!canConfirmPublish}
              className="rounded-md bg-violet-600 h-9 px-3 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {(publishMode === "schedule" ? t("Schedule") : t("Publish")) +
                (pendingVersionIds.length > 1 ? ` (${pendingVersionIds.length})` : "")}
            </button>
          </>
        }
      >
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setPublishMode("now")}
            className={`flex-1 rounded-md h-9 px-3 text-sm font-medium ring-1 ring-inset transition-colors ${
              publishMode === "now" ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-gray-600 ring-gray-300 hover:bg-gray-50"
            }`}
          >
            {t("Publish now")}
          </button>
          <button
            onClick={() => setPublishMode("schedule")}
            className={`flex-1 rounded-md h-9 px-3 text-sm font-medium ring-1 ring-inset transition-colors ${
              publishMode === "schedule" ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-gray-600 ring-gray-300 hover:bg-gray-50"
            }`}
          >
            {t("Schedule")}
          </button>
        </div>

        {publishMode === "schedule" && (
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">{t("Publish date & time")}</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-[#fff] h-9 px-3 text-sm focus:border-violet-400 focus:outline-none"
            />
          </div>
        )}

        <p className="mb-3">
          {publishMode === "schedule"
            ? t("At the scheduled time, this entry will go live on:")
            : t("This entry will go live now on:")}
        </p>
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t("Channels")}</p>
            {pendingChannels.length < channels.length && (
              <button
                onClick={() => setPendingChannels(channels.map((c) => c.id))}
                className="text-xs font-medium text-violet-600 hover:underline"
              >
                {t("Select all")}
              </button>
            )}
          </div>
          <div className="space-y-1">
            {channels.map((c) => {
              const Icon = CHANNEL_ICONS[c.icon] || Radio;
              return (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md border border-gray-300 h-9 px-3 text-sm text-gray-800 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={pendingChannels.includes(c.id)}
                    onChange={() => togglePendingChannel(c.id)}
                    className="h-4 w-4 rounded border-gray-300 accent-violet-600"
                  />
                  <Icon size={14} className="text-gray-500" />
                  {c.name}
                </label>
              );
            })}
          </div>
          {pendingChannels.length === 0 && (
            <p className="mt-1.5 text-xs text-red-600">{t("Select at least one channel")}</p>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">{t("Languages")}</p>
          <div className="space-y-1">
            {LOCALE_LIST.map((l) => {
              const version = l === entry.locale ? entry : siblings.find((sb) => sb.locale === l);
              if (!version) {
                return (
                  <div key={l} className="flex items-center gap-2.5 rounded-md border border-dashed border-gray-300 h-9 px-3 text-sm text-gray-400">
                    <span className="w-7 shrink-0 font-semibold">{LOCALE_LABELS[l]}</span>
                    {t("No version in this language yet")}
                  </div>
                );
              }
              const versionStatusId = normalizeEntryStatus(version.status, workflowSteps);
              const versionStep = workflowSteps.find((st) => st.id === versionStatusId);
              return (
                <label
                  key={l}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md border border-gray-300 h-9 px-3 text-sm text-gray-800 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={pendingVersionIds.includes(version.id)}
                    onChange={() => togglePendingVersion(version.id)}
                    className="h-4 w-4 rounded border-gray-300 accent-violet-600"
                  />
                  <span className="w-5 shrink-0 font-semibold text-gray-500">{LOCALE_LABELS[l]}</span>
                  <span className="flex-1">{t(LOCALE_NAMES[l] ?? l)}</span>
                  <StatusPill status={versionStep?.name ?? version.status} color={versionStep?.color} />
                </label>
              );
            })}
          </div>
          {pendingVersionIds.length === 0 && (
            <p className="mt-1.5 text-xs text-red-600">{t("Select at least one language")}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
