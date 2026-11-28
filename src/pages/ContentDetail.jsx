import { capHistory } from "../lib/history";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Smartphone, Globe, Radio, Tv, Mail, MessageSquare, Clock, History, ArrowLeft, MessageCircle, X, Languages, Send, FilePlus, Lock } from "lucide-react";
import { useLocalStorage } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { orderLocales } from "../lib/locales";
import {
  seedEntries, seedContentTypes, seedUsers, seedTaxonomies, seedMedia, LOCALE_LIST, LOCALE_LABELS, LOCALE_NAMES, normalizeEntryGroupId,
  DEFAULT_WORKFLOW_STEPS, normalizeWorkflowSteps, normalizeEntryStatus, SCHEDULED_STATUS_ID, withScheduledStep,
  DEFAULT_CHANNELS, normalizeChannels, ALL_CHANNELS, isAllChannels, resolvePublishedChannelIds,
} from "../lib/seed";
import { sharedFields, isEmptyValue, latestValue, hasLocalizedTexts, mergeLocalizedTexts, localizationOf } from "../lib/sharedFields";
import { usedIn, usedEntryIds, inLocale } from "../lib/usage";
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
import PublishDialog from "../components/PublishDialog";
import { useMediaUpload } from "../lib/mediaUpload";

const CHANNEL_ICONS = { smartphone: Smartphone, globe: Globe, radio: Radio, tv: Tv, mail: Mail, "message-square": MessageSquare };

function formatScheduled(iso, locale = "en-GB") {
  return new Date(iso).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// With the year, for moments that can lie far in the past (when something went live).
function formatWhen(iso, locale = "en-GB") {
  return new Date(iso).toLocaleString(locale, { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
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
      if (value === prevEntry.status || value === SCHEDULED_STATUS_ID) return null; // scheduling is described by its own line
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
      return changed.length > 0 ? `Element "${changedField?.label ?? changed[0]}" updated` : null;
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

// Space above the first and below the last field of the scrolling card. The card
// sets it as --pane-pad, because sticky offsets count from inside its padding.
const PANE_PAD = "2rem";

// The field-group tabs stay at the top of the scrolling card while the fields
// scroll under them. Sticky offsets count from inside the card's padding, so the
// strip sticks at -pane-pad (the card's edge), reaches over the side padding
// (-mx-5 / px-5; wide screens leave 5rem on the right, -mr-20 / pr-20) and has the card's background; padding rather than margin,
// because the card spaces its children with `space-y-*` margins. It reports its
// height so a rich text toolbar can stick right below it.
function StickyTabs({ onHeight, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const report = () => onHeight(el.offsetHeight);
    report();
    if (typeof ResizeObserver === "undefined") return () => onHeight(0);
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => { observer.disconnect(); onHeight(0); };
  }, [onHeight]);
  // Switching to another tab starts at the top edge of that tab: when the card is
  // scrolled past the strip (so it is stuck at the top), it is scrolled back to
  // where the strip stands exactly at the top, with the new tab's fields right
  // below it. Scrolled less than that, the strip is still in view and nothing
  // moves. The strip's own place in the flow is read with it un-stuck.
  const toTabTop = (e) => {
    if (!e.target.closest?.('[role="tab"]')) return;
    const strip = ref.current;
    const card = strip?.parentElement;
    if (!card) return;
    const position = strip.style.position;
    strip.style.position = "static";
    const natural = strip.getBoundingClientRect().top - card.getBoundingClientRect().top - card.clientTop + card.scrollTop;
    strip.style.position = position;
    if (card.scrollTop <= natural) return;
    // The new tab's fields replace the old ones when the click has been handled,
    // and the browser moves the scroll position while they do; set it afterwards.
    setTimeout(() => { card.scrollTop = natural; }, 0);
  };
  return (
    <div ref={ref} onClickCapture={toTabTop} className="sticky top-[calc(var(--pane-pad)*-1)] z-20 -ml-5 -mr-5 xl:-mr-20 bg-white pl-5 pr-5 xl:pr-20 pt-2">
      {children}
    </div>
  );
}

export default function ContentDetail() {
  const { id } = useParams();
  // Keyed by id so each entry starts from its own state (title, tab, dialogs),
  // also when you arrive from another entry (Open on a linked item, language switch).
  return <ContentDetailPage key={id} id={id} />;
}

function ContentDetailPage({ id }) {
  const { t, dateLocale } = useI18n();
  const fmtDate = (iso) => formatScheduled(iso, dateLocale);
  // When a published entry went live: recorded at publishing; for older entries the
  // last history step that was Published, else its last update.
  const publishedAtOf = (e) =>
    e.publishedAt ??
    [...(e.history ?? [])].reverse().find((h) => normalizeEntryStatus(h.snapshot?.status, workflowSteps) === publishStepId)?.timestamp ??
    e.updatedAt;
  const navigate = useNavigate();
  const [entries, setEntries] = useLocalStorage("cms.entries", seedEntries);
  const [defaultLocale] = useLocalStorage("cms.settings.defaultLocale", "cs");
  const [contentTypes] = useLocalStorage("cms.contentTypes", seedContentTypes);
  const [rawWorkflowSteps] = useLocalStorage("cms.settings.workflowSteps", DEFAULT_WORKFLOW_STEPS);
  const workflowSteps = useMemo(() => normalizeWorkflowSteps(rawWorkflowSteps), [rawWorkflowSteps]);
  const allSteps = useMemo(() => withScheduledStep(workflowSteps), [workflowSteps]); // the steps and the status of scheduled items
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
  const [historyMode, setHistoryMode] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState(null); // null = current live version
  const [commentDraft, setCommentDraft] = useState("");
  const [langDialogOpen, setLangDialogOpen] = useState(false);
  const langRef = useRef(null);
  useEffect(() => {
    if (!langDialogOpen) return undefined;
    const onDown = (e) => { if (langRef.current && !langRef.current.contains(e.target)) setLangDialogOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setLangDialogOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [langDialogOpen]);
  const [activeGroup, setActiveGroup] = useState(GENERAL);
  const [tabsHeight, setTabsHeight] = useState(0);

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

    // A change that is recorded in the history also makes the item "updated": the
    // list sorts by that and the side panel shows who and when.
    const changed = changeSummaries.length > 0;
    const now = new Date().toISOString();
    const merged = { ...target, ...patch, ...(changed ? { updatedAt: now, updatedBy: users[0]?.id } : {}) };
    const { history: _omit, live: _live, ...snapshot } = merged;
    const newHistoryEntry = changed
      ? [{ id: `h${Date.now()}-${target.id}`, timestamp: now, userId: users[0]?.id, summary: changeSummaries.join(", "), snapshot }]
      : [];
    return { ...merged, history: capHistory([...(target.history ?? []), ...newHistoryEntry]) };
  }

  function update(patch) {
    // A published item has no editable instance: only comments can still change.
    if ((isPublished || isScheduled) && Object.keys(patch).some((k) => k !== "comments")) return;
    setEntries(entries.map((e) => (e.id === id ? applyPatch(e, patch) : e)));
    setSaveStatus("saving");
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaveStatus("saved"), 600);
  }

  // A field that is not localized holds one value for all language versions (see
  // lib/sharedFields.js): it is written to the other versions of this item that
  // can still be edited too. A published version is left as it is.
  function setFieldValue(fieldName, value) {
    setFieldValues({ [fieldName]: value });
  }

  // Several elements at once (a place chosen on the map fills the address elements too).
  function setFieldValues(values) {
    const type = contentTypes.find((c) => c.id === entry.contentTypeId);
    const nextValues = { ...(entry.fieldValues ?? {}), ...values };
    const shared = sharedFields(type).filter((f) => f.name in values);
    if (shared.length === 0) { update({ fieldValues: nextValues }); return; }
    if (isPublished) return;
    const group = normalizeEntryGroupId(entry);
    setEntries(entries.map((e) => {
      if (e.id === id) return applyPatch(e, { fieldValues: nextValues });
      const sibling = e.contentTypeId === entry.contentTypeId && normalizeEntryGroupId(e) === group;
      if (!sibling || normalizeEntryStatus(e.status, workflowSteps) === publishStepId) return e;
      const next = { ...(e.fieldValues ?? {}) };
      for (const f of shared) {
        // Opening hours, admission and the like share their structure, not their names and notes.
        next[f.name] = hasLocalizedTexts(f.type) ? mergeLocalizedTexts(f.type, values[f.name], e.fieldValues?.[f.name]) : values[f.name];
      }
      return applyPatch(e, { fieldValues: next });
    }));
    flashSaved();
  }

  // A place chosen on the map: the map element gets it, and the address elements of the
  // item (street, postal code, quarter, city, region, country) are filled from it.
  const ADDRESS_ELEMENTS = {
    ulice: "street", psc: "postalCode", mestskacast: "district", lokalita: "quarter", mesto: "city", region: "region", zeme: "country",
  };
  function placeChosen(mapField, mapValue, parts) {
    const type = contentTypes.find((c) => c.id === entry.contentTypeId);
    const values = { [mapField]: mapValue };
    for (const f of type?.fields ?? []) {
      const part = ADDRESS_ELEMENTS[String(f.name).toLowerCase()];
      if (part && f.type === "Text" && parts[part]) values[f.name] = parts[part];
    }
    setFieldValues(values);
  }

  // Publishing is where channels get chosen: the dialog opens from the header
  // Publish button, or by moving the entry to the final workflow step.
  function openPublishDialog() {
    setPendingPublish(true);
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
    // The draft starts with what the other language versions hold now for the
    // fields shared between languages, which may have changed while this was live.
    const others = entries.filter((e) => e.id !== id && e.contentTypeId === entry.contentTypeId && normalizeEntryGroupId(e) === normalizeEntryGroupId(entry));
    const fresh = {};
    for (const f of sharedFields(contentTypes.find((c) => c.id === entry.contentTypeId))) {
      const latest = latestValue(others, f.name);
      const value = hasLocalizedTexts(f.type) ? mergeLocalizedTexts(f.type, latest, entry.fieldValues?.[f.name]) : latest;
      if (value !== undefined && JSON.stringify(value) !== JSON.stringify(entry.fieldValues?.[f.name])) fresh[f.name] = value;
    }
    const patch = {
      status: workflowSteps[0]?.id,
      scheduledPublishAt: null,
      live: { ...content, publishedAt: publishedAtOf(entry) },
      publishedAt: null,
      ...(Object.keys(fresh).length ? { fieldValues: { ...(entry.fieldValues ?? {}), ...fresh } } : {}),
    };
    setEntries(entries.map((e) => (e.id === id ? applyPatch(e, patch, "New draft created; the published version stays live") : e)));
    flashSaved();
  }

  // Takes the live version offline; a published item goes back to an editable
  // draft, a draft that sits over a live version just loses that live version.
  function confirmUnpublish() {
    const patch = isPublished ? { status: workflowSteps[0]?.id, scheduledPublishAt: null, live: null, publishedAt: null } : { live: null };
    setEntries(entries.map((e) => (e.id === id ? applyPatch(e, patch, "Unpublished") : e)));
    flashSaved();
    setPendingUnpublish(false);
  }

  // A scheduled item is read-only; cancelling the schedule makes it an editable draft again.
  function cancelSchedule() {
    setEntries(entries.map((e) => (e.id === id ? applyPatch(e, { status: workflowSteps[0]?.id, scheduledPublishAt: null }) : e)));
    flashSaved();
  }

  // Each language version stays its own entry (own status, history, comments):
  // the dialog just applies the same publish action to every ticked version.
  // The items that publishing these versions would leave unpublished although the
  // versions use them (linked or embedded), reached through other items' uses too, each
  // in the language of the version that uses it when it has one. Published items are
  // passed through without being listed.
  function unpublishedUsedBy(versionIds) {
    const queue = versionIds.map((vid) => entries.find((e) => e.id === vid)).filter(Boolean);
    const seen = new Set(queue.map((e) => e.id));
    const found = new Map();
    while (queue.length) {
      const host = queue.shift();
      for (const { id: usedId, how } of usedEntryIds(host, contentTypes)) {
        const picked = entries.find((e) => e.id === usedId);
        if (!picked) continue;
        const version = inLocale(picked, entries, host.locale);
        if (seen.has(version.id)) continue;
        seen.add(version.id);
        queue.push(version);
        if (normalizeEntryStatus(version.status, workflowSteps) !== publishStepId) found.set(version.id, { entry: version, how });
      }
    }
    return [...found.values()];
  }

  function confirmPublish({ mode, scheduledAt, channelIds, versionIds, includeUsed }) {
    if (channelIds.length === 0 || versionIds.length === 0) return;
    const channelsValue = channels.every((c) => channelIds.includes(c.id)) ? ALL_CHANNELS : channelIds;
    const patch = mode === "schedule" && scheduledAt
      ? { status: SCHEDULED_STATUS_ID, scheduledPublishAt: new Date(scheduledAt).toISOString(), channels: channelsValue }
      : { status: publishStepId, scheduledPublishAt: null, channels: channelsValue, live: null, publishedAt: new Date().toISOString() };
    const alsoIds = new Set(includeUsed ? unpublishedUsedBy(versionIds).map((u) => u.entry.id) : []);
    setEntries(entries.map((e) => (versionIds.includes(e.id) || alsoIds.has(e.id) ? applyPatch(e, patch) : e)));
    setSaveStatus("saving");
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaveStatus("saved"), 600);
    setPendingPublish(false);
    // The page changes (a notice, a different panel): show it from the top.
    setTimeout(() => {
      document.querySelectorAll("[data-scroll-pane]").forEach((el) => { el.scrollTop = 0; });
      window.scrollTo(0, 0);
    }, 0);
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
    const sharedNow = Object.fromEntries(
      sharedFields(contentTypes.find((c) => c.id === entry.contentTypeId))
        .filter((f) => !isEmptyValue(entry.fieldValues?.[f.name]))
        .map((f) => [f.name, entry.fieldValues[f.name]])
    );
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
      // Fields that are not localized start with the value they have in this version.
      ...(Object.keys(sharedNow).length ? { fieldValues: sharedNow } : {}),
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
  // Only the title and slug are always above the tabs. Everything else, the body
  // included, is laid out in the type's order and goes into the tab of its group (or
  // straight down the page when the type has no tabs).
  const layoutFields = showBody && bodyField ? [...extraFields, bodyField] : extraFields;
  const byTypeOrder = (a, b) => (type?.fields.indexOf(a) ?? 0) - (type?.fields.indexOf(b) ?? 0);
  const sections = sectionsOf(type, layoutFields);
  const activeSection = sections.find((s) => (s.name ?? GENERAL) === activeGroup) ?? sections[0];
  const itemsInTab = [...(sections.length > 1 ? activeSection.fields : layoutFields)].sort(byTypeOrder);
  const groupTabs = sections.length > 1 && (
    <StickyTabs onHeight={setTabsHeight}>
      <GroupTabs tabs={sections.map((s) => ({ id: s.name ?? GENERAL, label: s.name ?? "General" }))} active={activeSection.name ?? GENERAL} onSelect={setActiveGroup} />
    </StickyTabs>
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
  const fieldCtx = { taxonomies, media, entries, contentTypes, workflowSteps, publishStepId, entryId: entry.id, locale: entry.locale, uploadMedia: mediaUpload.upload, placeChosen };
  const viewBody = () => (
    <DetailField key="body" label={bodyField?.label ?? "Body"} required={bodyField?.required} localized={bodyField?.localized}>
      <RichTextView key={selectedVersionId ?? "current"} value={viewEntry.body} media={media} content={fieldCtx} tiles />
    </DetailField>
  );
  const editBody = () => (
    <DetailField key="body" label={bodyField?.label ?? "Body"} required={bodyField?.required} localized={bodyField?.localized}>
      <RichTextEditor
        key={`${entry.id}-body`}
        value={entry.body}
        placeholder={t("Rich text content goes here…")}
        onChange={(html) => update({ body: html })}
        minHeight={220}
        media={media}
        onUpload={mediaUpload.upload}
        locale={entry.locale}
        content={fieldCtx}
        options={bodyField?.richText}
      />
    </DetailField>
  );
  const viewField = (f) => f.type === "Separator" ? <FieldSeparator key={f.name} /> : (
    <Fragment key={f.name}>
      <DetailField label={f.label ?? f.name} required={f.required} localized={localizationOf(f)}>
        {isEmpty(viewEntry.fieldValues?.[f.name])
          ? <p className="text-sm text-gray-400">—</p>
          : <FieldView field={f} value={viewEntry.fieldValues?.[f.name]} ctx={fieldCtx} compact thumbnails />}
      </DetailField>
    </Fragment>
  );
  const editField = (f) => f.type === "Separator" ? <FieldSeparator key={f.name} /> : (
    <Fragment key={f.name}>
      <DetailField label={f.label ?? f.name} required={f.required} localized={localizationOf(f)}>
        <FieldEditor
          key={`${entry.id}-${f.name}`}
          field={f}
          value={entry.fieldValues?.[f.name]}
          onChange={(value) => setFieldValue(f.name, value)}
          ctx={fieldCtx}
        />
      </DetailField>
    </Fragment>
  );
  const author = users.find((u) => u.id === entry.updatedBy);
  const displayStatus = normalizeEntryStatus(entry.status, workflowSteps);
  const currentStep = allSteps.find((s) => s.id === displayStatus);
  const publishedStep = workflowSteps[workflowSteps.length - 1];
  const isPublished = displayStatus === publishStepId;
  const isScheduled = displayStatus === SCHEDULED_STATUS_ID;
  // Published and scheduled content is shown read-only; so is any past version in history.
  const readOnly = historyMode || isPublished || isScheduled;
  const publishedChannelIds = resolvePublishedChannelIds(entry.channels, channels);
  // The live version that a newer draft or a scheduled item sits over.
  const liveVersionBlock = entry.live && (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-gray-50 px-2.5 py-2 ring-1 ring-inset ring-gray-200">
      <span className="text-xs text-gray-500">{t("Live version")}</span>
      <StatusPill status={publishedStep?.name ?? "Published"} color={publishedStep?.color} />
      <span className="flex w-full items-center gap-1.5 text-xs text-gray-500">
        <Clock size={12} /> {t("Live since {when}", { when: formatWhen(entry.live.publishedAt ?? entry.live.updatedAt, dateLocale) })}
      </span>
      <button
        onClick={() => setPendingUnpublish(true)}
        className="rounded-md border border-gray-300 bg-white h-7 px-2.5 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        {t("Unpublish")}
      </button>
    </div>
  );
  const entryIsAllChannels = isAllChannels(entry.channels);


  const groupId = normalizeEntryGroupId(entry);
  const siblings = entries.filter((e) => e.id !== entry.id && normalizeEntryGroupId(e) === groupId);
  const usages = usedIn(entry, entries, contentTypes, entry.locale);

  const history = entry.history ?? [];
  const comments = entry.comments ?? [];
  const selectedVersion = selectedVersionId ? history.find((h) => h.id === selectedVersionId) : null;
  const viewEntry = selectedVersion ? selectedVersion.snapshot : entry;
  const viewStep = allSteps.find((s) => s.id === normalizeEntryStatus(viewEntry.status, workflowSteps));
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
            <div ref={langRef} className="relative">
              <button
                onClick={() => setLangDialogOpen((o) => !o)}
                aria-haspopup="dialog"
                aria-expanded={langDialogOpen}
                className="flex items-center gap-1.5 rounded-md h-9 px-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-200 hover:text-gray-900"
              >
                <Languages size={14} /> {t("Languages")}
                <span className="rounded-full bg-gray-100 px-1.5 text-xs font-normal text-gray-500">
                  {siblings.length + 1}/{LOCALE_LIST.length}
                </span>
              </button>
              {langDialogOpen && (
                <div role="dialog" aria-label={t("Languages")} className="wf-pop absolute right-0 top-full z-50 mt-2 w-96 rounded-lg border border-gray-300 bg-white p-3">
                <div className="space-y-2">
                  {orderLocales(defaultLocale).map((l) => {
                    const isCurrent = l === entry.locale;
                    const sibling = isCurrent ? entry : siblings.find((s) => s.locale === l);
                    const step = sibling ? allSteps.find((s) => s.id === normalizeEntryStatus(sibling.status, workflowSteps)) : null;
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
                </div>
              )}
            </div>
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
              // Publishing (published, scheduled) is blue; a past version is a warning, amber.
              className={`mb-4 flex shrink-0 items-start gap-3 rounded-md border border-l-4 px-4 py-3 text-sm font-medium ${
                historyMode
                  ? "border-amber-300 border-l-amber-500 bg-amber-100 text-amber-950"
                  : "border-blue-300 border-l-blue-500 bg-blue-100 text-blue-950"
              }`}
            >
              {historyMode ? <History size={18} className="mt-px shrink-0 text-amber-700" /> : isScheduled ? <Clock size={18} className="mt-px shrink-0 text-blue-700" /> : <Lock size={18} className="mt-px shrink-0 text-blue-700" />}
              <span>
                {historyMode
                  ? (selectedVersion
                    ? t("Viewing a read-only past version. Use Back to resume editing.")
                    : t("Viewing a read-only snapshot of the current version. Use Back to resume editing."))
                  : isScheduled
                    ? t("This item is scheduled for {when}, so it can't be edited. Cancel the schedule to make changes.", { when: fmtDate(entry.scheduledPublishAt) })
                    : t("This item is published, so it can't be edited. Create a new draft to make changes; the published version stays live meanwhile.")}
              </span>
            </div>
          )}
        {readOnly ? (
          <div data-scroll-pane style={{ "--pane-pad": PANE_PAD }} className="min-h-0 flex-1 space-y-8 overflow-y-auto rounded-lg border border-gray-300 bg-white pl-5 pr-5 xl:pr-20 py-[var(--pane-pad)]">
            <DetailField label="Title" required={titleField?.required} localized={titleField?.localized}>
              <p className="text-sm text-gray-900">{viewEntry.title}</p>
            </DetailField>
            <DetailField label="Slug" required={slugField?.required} localized={slugField?.localized}>
              <p className="text-sm text-gray-500">/{slugOf(viewEntry)}</p>
            </DetailField>
            {showBody && !bodyField && viewBody()}
            {groupTabs}
            {singleGroupHeading}
            {itemsInTab.map((f) => (f === bodyField ? viewBody() : viewField(f)))}
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
          <div data-scroll-pane style={{ "--pane-pad": PANE_PAD, "--sticky-tabs": `${tabsHeight}px` }} className="min-h-0 flex-1 space-y-8 overflow-y-auto rounded-lg border border-gray-300 bg-white pl-5 pr-5 xl:pr-20 py-[var(--pane-pad)]">
            <DetailField label="Title" required={titleField?.required} localized={titleField?.localized}>
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
            {showBody && !bodyField && editBody()}

            {groupTabs}
            {singleGroupHeading}
            {itemsInTab.map((f) => (f === bodyField ? editBody() : editField(f)))}
          </div>
        )}
        </div>

        {historyMode ? (
          <div data-scroll-pane className="max-h-full w-80 shrink-0 space-y-3 self-start overflow-y-auto rounded-lg border border-gray-300 bg-white p-5">
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
          <div data-scroll-pane className="max-h-full w-80 shrink-0 space-y-8 self-start overflow-y-auto rounded-lg border border-gray-300 bg-white p-5">
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
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock size={12} /> {t("Live since {when}", { when: formatWhen(publishedAtOf(entry), dateLocale) })}
                  </p>
                  <button
                    onClick={createDraft}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-violet-600 h-9 px-3 text-sm font-medium text-white hover:bg-violet-700"
                  >
                    <FilePlus size={14} /> {t("Create new draft")}
                  </button>
                  <p className="mt-2 text-xs text-gray-400">{t("Published content can't be changed. A new draft leaves this version live until you publish the draft.")}</p>
                </>
              ) : isScheduled ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={currentStep?.name ?? entry.status} color={currentStep?.color} />
                    <button
                      onClick={cancelSchedule}
                      className="rounded-md border border-gray-300 bg-white h-7 px-2.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      {t("Cancel schedule")}
                    </button>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock size={12} /> {t("Scheduled for {when}", { when: fmtDate(entry.scheduledPublishAt) })}
                  </p>
                  {liveVersionBlock}
                </>
              ) : (
                <>
                  <StatusSelect
                    value={displayStatus}
                    steps={workflowSteps.slice(0, -1)}
                    onChange={handleStatusChange}
                    fallbackLabel={entry.status}
                  />
                  {liveVersionBlock}
                </>
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
            <DetailField label="Used in">
              {usages.length === 0 ? (
                <p className="text-sm text-gray-400">{t("Not used anywhere yet.")}</p>
              ) : (
                <ul className="space-y-2.5">
                  {usages.slice(0, 8).map((u) => {
                    const uType = contentTypes.find((ct) => ct.id === u.entry.contentTypeId);
                    return (
                      <li key={u.entry.id} className="text-sm">
                        <Link to={`/content/${u.entry.id}`} className="font-medium text-gray-900 underline-offset-2 hover:underline">{u.entry.title}</Link>
                        <span className="block text-xs text-gray-500">
                          {uType ? t(uType.name) : ""} · {u.how.map((h) => t(h === "embedded" ? "Embedded in text" : "Linked")).join(", ")}
                          {u.locales.length > 0 && ` · ${orderLocales(defaultLocale).filter((l) => u.locales.includes(l)).map((l) => LOCALE_LABELS[l] ?? l.toUpperCase()).join(" ")}`}
                        </span>
                      </li>
                    );
                  })}
                  {usages.length > 8 && <li className="text-xs text-gray-400">{t("and {n} more", { n: usages.length - 8 })}</li>}
                </ul>
              )}
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

      <PublishDialog
        open={pendingPublish}
        onClose={() => setPendingPublish(false)}
        title={t('Publish "{title}"?', { title: entry.title })}
        channels={channels}
        initialChannelIds={publishedChannelIds}
        initialVersionIds={[entry.id]}
        languageRows={orderLocales(defaultLocale).map((l) => {
          const version = l === entry.locale ? entry : siblings.find((sb) => sb.locale === l);
          const step = version && allSteps.find((st) => st.id === normalizeEntryStatus(version.status, workflowSteps));
          return { locale: l, versionIds: version ? [version.id] : [], pill: version ? { name: step?.name ?? version.status, color: step?.color } : null };
        })}
        texts={{ now: "This entry will go live now on:", schedule: "At the scheduled time, this entry will go live on:" }}
        emptyLabel="No version in this language yet"
        usedFor={(ids) => unpublishedUsedBy(ids).map(({ entry: u, how }) => ({
          id: u.id,
          title: u.title,
          typeName: t(contentTypes.find((ct) => ct.id === u.contentTypeId)?.name ?? ""),
          how,
        }))}
        onConfirm={confirmPublish}
      />
    </div>
  );
}
