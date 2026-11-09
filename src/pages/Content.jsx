import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronDown, Copy, Trash2 } from "lucide-react";
import { useLocalStorage } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { typeIcon } from "../lib/typeIcons";
import { seedEntries, seedContentTypes, seedUsers, LOCALE_LIST, LOCALE_LABELS, LOCALE_NAMES, normalizeEntryGroupId, DEFAULT_WORKFLOW_STEPS, normalizeWorkflowSteps, normalizeEntryStatus, DEFAULT_CHANNELS, normalizeChannels, ALL_CHANNELS, isAllChannels, resolvePublishedChannelIds } from "../lib/seed";
import Sidebar from "../components/Sidebar";
import DataTable from "../components/DataTable";
import BulkActionsMenu from "../components/BulkActionsMenu";
import Modal from "../components/Modal";
import StatusPill from "../components/StatusPill";
import Avatar from "../components/Avatar";
import { FilterBar } from "../components/FilterBar";


function timeAgo(iso, t, dateLocale) {
  const diff = (new Date("2026-08-12T18:00:00") - new Date(iso)) / 36e5;
  if (diff < 24) return t("Today at {time}", { time: new Date(iso).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" }) });
  if (diff < 48) return t("Yesterday");
  return new Date(iso).toLocaleDateString(dateLocale, { day: "2-digit", month: "short" });
}

export default function Content() {
  const navigate = useNavigate();
  const { t, dateLocale } = useI18n();
  const [entries, setEntries] = useLocalStorage("cms.entries", seedEntries);
  const [defaultLocale] = useLocalStorage("cms.settings.defaultLocale", "en");
  const [contentTypes] = useLocalStorage("cms.contentTypes", seedContentTypes);
  const [rawWorkflowSteps] = useLocalStorage("cms.settings.workflowSteps", DEFAULT_WORKFLOW_STEPS);
  const workflowSteps = useMemo(() => normalizeWorkflowSteps(rawWorkflowSteps), [rawWorkflowSteps]);
  const [rawChannels] = useLocalStorage("cms.settings.channels", DEFAULT_CHANNELS);
  const channels = useMemo(() => normalizeChannels(rawChannels), [rawChannels]);
  const channelsById = useMemo(() => Object.fromEntries(channels.map((c) => [c.id, c])), [channels]);
  const users = useMemo(() => seedUsers(), []);
  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const publishStepId = workflowSteps[workflowSteps.length - 1]?.id;
  const typesById = useMemo(() => Object.fromEntries(contentTypes.map((t) => [t.id, t])), [contentTypes]);

  // Self-heal entries whose status predates the Workflow feature (or names a
  // step that no longer exists) so the table/sidebar never show raw garbage.
  const displayEntries = useMemo(
    () =>
      entries.map((e) => ({
        ...e,
        status: normalizeEntryStatus(e.status, workflowSteps),
        groupId: normalizeEntryGroupId(e),
      })),
    [entries, workflowSteps]
  );
  useEffect(() => {
    const needsFix = entries.some(
      (e, i) => e.status !== displayEntries[i].status || e.groupId !== displayEntries[i].groupId
    );
    if (needsFix) setEntries(displayEntries);
  }, [entries, displayEntries]);

  // Which locales exist among each group of linked language versions, so the
  // Localization column can show presence/absence regardless of the current
  // filter/sort of the table.
  const localesByGroup = useMemo(() => {
    const map = {};
    displayEntries.forEach((e) => {
      if (!map[e.groupId]) map[e.groupId] = new Set();
      map[e.groupId].add(e.locale);
    });
    return map;
  }, [displayEntries]);

  // Language is a persistent view scope (like switching workspaces), not one
  // more exclusive quick-filter — it stays applied across every other filter
  // and starts on the workspace's default language.
  const [activeLocale, setActiveLocale] = useState(defaultLocale);

  const [filter, setFilter] = useState({ view: "all", status: null, typeId: null, channelId: null });
  const [extraFilters, setExtraFilters] = useState({ updatedBy: null });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftType, setDraftType] = useState(contentTypes[0]?.id);

  const scopedEntries = useMemo(() => displayEntries.filter((e) => e.locale === activeLocale), [displayEntries, activeLocale]);

  const statuses = workflowSteps.map((step) => ({
    id: step.id,
    name: step.name,
    color: step.color,
    count: scopedEntries.filter((e) => e.status === step.id).length,
  }));

  const filterValues = { status: filter.status, contentTypeId: filter.typeId, channel: filter.channelId, ...extraFilters };

  function handleFilterChange(key, value) {
    if (key === "status") return setFilter({ view: value ? "status" : "all", status: value, typeId: null, channelId: null });
    if (key === "contentTypeId") return setFilter({ view: value ? "type" : "all", status: null, typeId: value, channelId: null });
    if (key === "channel") return setFilter({ view: value ? "channel" : "all", status: null, typeId: null, channelId: value });
    setExtraFilters((v) => ({ ...v, [key]: value }));
  }

  function clearFilters() {
    setFilter({ view: "all", status: null, typeId: null, channelId: null });
    setExtraFilters({ updatedBy: null });
  }

  const filterFields = [
    { key: "status", label: "Status", options: workflowSteps.map((s) => ({ value: s.id, label: s.name })) },
    { key: "contentTypeId", label: "Content type", options: contentTypes.map((t) => ({ value: t.id, label: t.name })) },
    { key: "channel", label: "Channel", options: channels.map((c) => ({ value: c.id, label: c.name })) },
    { key: "updatedBy", label: "Updated by", options: users.map((u) => ({ value: u.id, label: u.name })) },
  ];

  const filtered = scopedEntries.filter((e) => {
    if (filter.view === "scheduled" && !e.scheduledPublishAt) return false;
    if (filter.status && e.status !== filter.status) return false;
    if (filter.typeId && e.contentTypeId !== filter.typeId) return false;
    if (extraFilters.updatedBy && e.updatedBy !== extraFilters.updatedBy) return false;
    if (filter.channelId && !resolvePublishedChannelIds(e.channels, channels).includes(filter.channelId)) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // The type picked in the sidebar (if any) is preselected.
  function openCreate() {
    setDraftTitle("");
    setDraftType(filter.typeId ?? contentTypes[0]?.id);
    setAdding(true);
  }

  function addEntry() {
    if (!draftTitle.trim() || !draftType) return;
    const id = `e${Date.now()}`;
    const newEntry = {
      id,
      groupId: id,
      title: draftTitle.trim(),
      contentTypeId: draftType,
      status: workflowSteps[0]?.id,
      locale: activeLocale,
      channels: ALL_CHANNELS,
      updatedAt: "2026-08-12T18:00:00",
      updatedBy: usersById && users[0].id,
    };
    setEntries([
      {
        ...newEntry,
        history: [{ id: `h${Date.now()}`, timestamp: new Date().toISOString(), userId: users[0]?.id, summary: "Entry created", snapshot: newEntry }],
      },
      ...entries,
    ]);
    setDraftTitle("");
    setAdding(false);
    navigate(`/content/${id}`);
  }

  const selectedIds = [...selected];

  function clearSelection() {
    setSelected(new Set());
  }

  function withHistory(entry, patch, summary) {
    const merged = { ...entry, ...patch, updatedAt: new Date().toISOString(), updatedBy: users[0]?.id };
    const { history: _omit, live: _live, ...snapshot } = merged;
    return { ...merged, history: [...(entry.history ?? []), { id: `h${Date.now()}-${entry.id}`, timestamp: merged.updatedAt, userId: users[0]?.id, summary, snapshot }] };
  }

  function changeStatusOfSelected(step) {
    setEntries(entries.map((e) =>
      selected.has(e.id) && e.status !== step.id && e.status !== publishStepId
        ? withHistory(e, { status: step.id }, `Status changed to "${step.name}"`)
        : e
    ));
    clearSelection();
  }

  // A copy is a new content item (own group), back at the first workflow step.
  function duplicateSelected() {
    const stamp = Date.now();
    const copies = entries.filter((e) => selected.has(e.id)).map((e, i) => {
      const id = `e${stamp}-${i}`;
      const { history: _h, comments: _c, scheduledPublishAt: _s, live: _l, ...rest } = e;
      const copy = { ...rest, id, groupId: id, title: `${e.title} (${t("copy")})`, status: workflowSteps[0]?.id, updatedAt: new Date().toISOString(), updatedBy: users[0]?.id };
      return { ...copy, history: [{ id: `h${stamp}-${i}`, timestamp: copy.updatedAt, userId: users[0]?.id, summary: "Entry created", snapshot: copy }] };
    });
    setEntries([...copies, ...entries]);
    clearSelection();
  }

  function deleteSelected() {
    setEntries(entries.filter((e) => !selected.has(e.id)));
    clearSelection();
  }

  const bulkActions = [
    { heading: "Change status" },
    ...workflowSteps.slice(0, -1).map((step) => ({ label: step.name, noTranslate: true, color: step.color, onSelect: () => changeStatusOfSelected(step) })),
    { heading: "More" },
    { label: "Duplicate", icon: Copy, onSelect: duplicateSelected },
    {
      label: "Delete", icon: Trash2, danger: true, onSelect: deleteSelected,
      confirm: { title: "Delete selected content?", message: "{n} selected will be permanently deleted. This can't be undone.", confirmLabel: "Delete" },
    },
  ];

  const columns = [
    {
      key: "title",
      header: "Name",
      sortValue: (r) => r.title,
      render: (r) => <span className="font-medium text-gray-900">{r.title}</span>,
    },
    {
      key: "type",
      header: "Content Type",
      sortValue: (r) => typesById[r.contentTypeId]?.name ?? "",
      render: (r) => {
        const ty = typesById[r.contentTypeId];
        const Icon = typeIcon(ty?.icon);
        return (
          <span className="inline-flex items-center gap-1.5 text-gray-600">
            <Icon size={14} style={{ color: ty?.color }} />
            {ty ? t(ty.name) : ""}
          </span>
        );
      },
    },
    {
      key: "updatedAt",
      header: "Updated",
      sortValue: (r) => r.updatedAt,
      render: (r) => <span className="text-gray-500">{timeAgo(r.updatedAt, t, dateLocale)}</span>,
    },
    {
      key: "updatedBy",
      header: "Last updated by",
      sortValue: (r) => usersById[r.updatedBy]?.name ?? "",
      render: (r) => {
        const u = usersById[r.updatedBy];
        return (
          <span className="inline-flex items-center gap-2">
            <Avatar user={u} size={20} />
            <span className="text-gray-600">{u?.name}</span>
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => {
        const step = workflowSteps.find((s) => s.id === r.status);
        // An item with a newer draft over a live version shows both.
        const liveStep = r.live && r.status !== publishStepId ? workflowSteps[workflowSteps.length - 1] : null;
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <StatusPill status={step?.name ?? r.status} color={step?.color} />
            {liveStep && <StatusPill status={liveStep.name} color={liveStep.color} />}
          </span>
        );
      },
    },
    {
      key: "channels",
      header: "Channels",
      sortValue: (r) => {
        if (isAllChannels(r.channels)) return "All channels";
        const c = channelsById[resolvePublishedChannelIds(r.channels, channels)[0]];
        return c?.name ?? "";
      },
      render: (r) =>
        isAllChannels(r.channels) ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-transparent px-2.5 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-inset ring-gray-300">
            {t("All channels")}
          </span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {resolvePublishedChannelIds(r.channels, channels).map((cid) => {
              const c = channelsById[cid];
              if (!c) return null;
              return <StatusPill key={cid} status={c.name} color={c.color} />;
            })}
          </div>
        ),
    },
    {
      key: "localization",
      header: "Localization",
      sortValue: (r) => localesByGroup[r.groupId]?.size ?? 1,
      render: (r) => {
        const present = localesByGroup[r.groupId] ?? new Set([r.locale]);
        return (
          <div className="flex items-center gap-1">
            {LOCALE_LIST.map((l) => {
              const isSelf = l === r.locale;
              const exists = present.has(l);
              return (
                <span
                  key={l}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                    isSelf
                      ? "bg-violet-600 text-white"
                      : exists
                        ? "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200"
                        : "text-gray-300"
                  }`}
                >
                  {LOCALE_LABELS[l] ?? l.toUpperCase()}
                </span>
              );
            })}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex h-full min-h-0">
      <Sidebar
        allLabel="All content"
        statusGroupLabel="Workflow step"
        statuses={statuses}
        typeGroupLabel="Content type"
        typeItems={contentTypes.map((t) => ({ id: t.id, name: t.name, count: entries.filter((e) => e.contentTypeId === t.id).length, icon: t.icon }))}
        channelGroupLabel="Channel"
        channelItems={channels.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          count: scopedEntries.filter((e) => resolvePublishedChannelIds(e.channels, channels).includes(c.id)).length,
        }))}
        filter={filter}
        onFilter={(f) => { setFilter(f); setSearch(""); }}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{t("All content")}</h1>
            <BulkActionsMenu count={selected.size} actions={bulkActions} />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={activeLocale}
                onChange={(e) => setActiveLocale(e.target.value)}
                className="h-9 appearance-none rounded-md border border-gray-300 bg-white pl-3 pr-8 text-sm font-medium text-gray-700 focus:border-violet-400 focus:outline-none"
              >
                {LOCALE_LIST.map((l) => (
                  <option key={l} value={l}>
                    {t(LOCALE_NAMES[l] ?? l.toUpperCase()) + (l === defaultLocale ? ` (${t("default")})` : "")}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-md bg-violet-600 h-9 px-3 text-sm font-medium text-white hover:bg-violet-700"
            >
              <Plus size={15} /> {t("Create new")}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <FilterBar
            typeFacetLabel="Content type"
            typeLabel={typesById[filter.typeId]?.name ?? "Any"}
            typeOptions={contentTypes.map((ct) => ({ value: ct.id, label: ct.name, icon: ct.icon, color: ct.color }))}
            typeValue={filter.typeId}
            onTypeChange={(value) => handleFilterChange("contentTypeId", value)}
            search={search}
            onSearchChange={setSearch}
            filterFields={filterFields}
            filterValues={filterValues}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
          />
        </div>

        <Modal
          open={adding}
          onClose={() => setAdding(false)}
          title={t("New content item")}
          maxWidth="max-w-md"
          footer={
            <>
              <button onClick={() => setAdding(false)} className="rounded-md h-9 px-3 text-sm text-gray-500 hover:bg-gray-100">{t("Cancel")}</button>
              <button
                onClick={addEntry}
                disabled={!draftTitle.trim() || !draftType}
                className="rounded-md bg-gray-700 h-9 px-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
              >
                {t("Create")}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">{t("Title")}</label>
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEntry()}
                className="w-full rounded-md border border-gray-300 bg-white h-9 px-3 text-sm focus:border-violet-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">{t("Content type")}</label>
              <div className="grid max-h-60 grid-cols-2 gap-1.5 overflow-y-auto">
                {contentTypes.map((ct) => {
                  const Icon = typeIcon(ct.icon);
                  const active = draftType === ct.id;
                  return (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => setDraftType(ct.id)}
                      aria-pressed={active}
                      className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm ${
                        active ? "border-gray-700 bg-gray-100 text-gray-900" : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Icon size={15} className="shrink-0" />
                      <span className="truncate">{t(ct.name)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>

        <div className="rounded-lg border border-gray-300 bg-white">
          <DataTable
            columns={columns}
            rows={filtered}
            selected={selected}
            onSelectedChange={setSelected}
            onRowClick={(row) => navigate(`/content/${row.id}`)}
            defaultSort={{ key: "updatedAt", dir: "desc" }}
          />
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400">
            <span>{t("{n} selected", { n: selected.size })}</span>
            <span>{t("Showing {n} of {total}", { n: filtered.length, total: scopedEntries.length })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
