import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUp, ArrowDown, Trash2, Plus, Check, Smartphone, Globe, Radio, Tv, Mail, MessageSquare, Download, Upload } from "lucide-react";
import { useLocalStorage } from "../lib/storage";
import { useI18n, UI_LANGUAGES } from "../lib/i18n";
import { seedUsers, DEFAULT_WORKFLOW_STEPS, normalizeWorkflowSteps, WORKFLOW_COLOR_PALETTE, DEFAULT_CHANNELS, normalizeChannels } from "../lib/seed";
import DataTable from "../components/DataTable";
import Avatar from "../components/Avatar";
import Modal from "../components/Modal";
import { isSharedKey, isSyncEnabled, markDirty, overwriteShared, sharedKeys } from "../lib/sync";

const TABS = [
  { id: "general", label: "General" },
  { id: "workflow", label: "Workflow" },
  { id: "channels", label: "Channels" },
  { id: "users", label: "Users & roles" },
  { id: "api", label: "API keys" },
  { id: "data", label: "Data" },
];

const CHANNEL_ICONS = { smartphone: Smartphone, globe: Globe, radio: Radio, tv: Tv, mail: Mail, "message-square": MessageSquare };
const CHANNEL_ICON_KEYS = Object.keys(CHANNEL_ICONS);

const ROLES = ["Admin", "Editor", "Viewer"];

const API_KEYS = [
  { id: "k1", name: "Production", prefix: "sk_live_4f2a…", createdAt: "2026-06-02", lastUsed: "2026-08-11" },
  { id: "k2", name: "Staging", prefix: "sk_test_91bd…", createdAt: "2026-05-14", lastUsed: "2026-08-09" },
  { id: "k3", name: "Local dev", prefix: "sk_test_02ee…", createdAt: "2026-07-30", lastUsed: "2026-08-12" },
];

function GeneralPanel() {
  const { t, lang, setLang } = useI18n();
  const [name, setName] = useLocalStorage("cms.settings.workspaceName", "Cargo Workspace");
  const [locale, setLocale] = useLocalStorage("cms.settings.defaultLocale", "en");

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("Workspace name")}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("Default locale")}</label>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
        >
          <option value="en">{t("English")} (en)</option>
          <option value="cs">{t("Czech")} (cs)</option>
          <option value="de">{t("German")} (de)</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t("Interface language")}</label>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
        >
          {UI_LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">{t("The language of the CMS menus and labels. Content languages are set separately.")}</p>
      </div>
      <button className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
        {t("Save changes")}
      </button>
    </div>
  );
}

function WorkflowPanel() {
  const { t } = useI18n();
  const [rawSteps, setSteps] = useLocalStorage("cms.settings.workflowSteps", DEFAULT_WORKFLOW_STEPS);
  const steps = useMemo(() => normalizeWorkflowSteps(rawSteps), [rawSteps]);

  useEffect(() => {
    if (rawSteps.some((s) => typeof s === "string" || !s.color)) setSteps(steps);
  }, [rawSteps, steps]);

  function updateStep(i, patch) {
    setSteps(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function moveStep(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  }

  function removeStep(i) {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, idx) => idx !== i));
  }

  function addStep() {
    setSteps([...steps, { id: `step-${Date.now()}`, name: t("Step {n}", { n: steps.length + 1 }), color: WORKFLOW_COLOR_PALETTE[steps.length % WORKFLOW_COLOR_PALETTE.length] }]);
  }

  return (
    <div className="max-w-lg">
      <p className="mb-4 text-sm text-gray-500">
        {t("Define the stages content moves through from draft to published, in order, with a color for each.")}
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {steps.map((s, i) => (
          <span key={s.id} className="flex items-center gap-1.5">
            <span
              className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-800 ring-1 ring-inset ring-gray-300"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name ? t(s.name) : t("Step {n}", { n: i + 1 })}
            </span>
            {i < steps.length - 1 && <ArrowRight size={12} className="text-gray-300" />}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={s.id} className="space-y-2 rounded-md border border-gray-300 bg-white p-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                {i + 1}
              </span>
              <input
                value={s.name}
                onChange={(e) => updateStep(i, { name: e.target.value })}
                className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-violet-400 focus:outline-none"
              />
              <button
                onClick={() => moveStep(i, -1)}
                disabled={i === 0}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
              >
                <ArrowUp size={14} />
              </button>
              <button
                onClick={() => moveStep(i, 1)}
                disabled={i === steps.length - 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
              >
                <ArrowDown size={14} />
              </button>
              <button
                onClick={() => removeStep(i)}
                disabled={steps.length <= 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-30"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex items-center gap-1.5 pl-8">
              {WORKFLOW_COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => updateStep(i, { color: c })}
                  title={c}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: c }}
                >
                  {s.color === c && <Check size={12} className="text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button onClick={addStep} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700">
        <Plus size={14} /> {t("Add step")}
      </button>
    </div>
  );
}

function ChannelsPanel() {
  const { t } = useI18n();
  const [rawChannels, setChannels] = useLocalStorage("cms.settings.channels", DEFAULT_CHANNELS);
  const channels = useMemo(() => normalizeChannels(rawChannels), [rawChannels]);

  useEffect(() => {
    if (rawChannels.some((c) => !c.id || !c.color)) setChannels(channels);
  }, [rawChannels, channels]);

  function updateChannel(i, patch) {
    setChannels(channels.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function moveChannel(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= channels.length) return;
    const next = [...channels];
    [next[i], next[j]] = [next[j], next[i]];
    setChannels(next);
  }

  function removeChannel(i) {
    if (channels.length <= 1) return;
    setChannels(channels.filter((_, idx) => idx !== i));
  }

  function addChannel() {
    setChannels([
      ...channels,
      {
        id: `channel-${Date.now()}`,
        name: t("Channel {n}", { n: channels.length + 1 }),
        icon: CHANNEL_ICON_KEYS[channels.length % CHANNEL_ICON_KEYS.length],
        color: WORKFLOW_COLOR_PALETTE[channels.length % WORKFLOW_COLOR_PALETTE.length],
      },
    ]);
  }

  return (
    <div className="max-w-lg">
      <p className="mb-4 text-sm text-gray-500">
        {t("Define the channels a piece of content can publish to. Most content goes out on every channel; some is channel-specific.")}
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        {channels.map((c) => {
          const Icon = CHANNEL_ICONS[c.icon] || Radio;
          return (
            <span
              key={c.id}
              className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-800 ring-1 ring-inset ring-gray-300"
            >
              <Icon size={12} />
              {c.name}
            </span>
          );
        })}
      </div>

      <div className="space-y-2">
        {channels.map((c, i) => {
          const Icon = CHANNEL_ICONS[c.icon] || Radio;
          return (
            <div key={c.id} className="space-y-2 rounded-md border border-gray-300 bg-white p-2">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-800"
                >
                  <Icon size={13} />
                </span>
                <input
                  value={c.name}
                  onChange={(e) => updateChannel(i, { name: e.target.value })}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-violet-400 focus:outline-none"
                />
                <button
                  onClick={() => moveChannel(i, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={() => moveChannel(i, 1)}
                  disabled={i === channels.length - 1}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  onClick={() => removeChannel(i)}
                  disabled={channels.length <= 1}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-30"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center gap-3 pl-8">
                <div className="flex items-center gap-1">
                  {CHANNEL_ICON_KEYS.map((key) => {
                    const OptIcon = CHANNEL_ICONS[key];
                    return (
                      <button
                        key={key}
                        onClick={() => updateChannel(i, { icon: key })}
                        className={`flex h-6 w-6 items-center justify-center rounded ${
                          c.icon === key ? "bg-gray-200 text-gray-900" : "text-gray-400 hover:bg-gray-100"
                        }`}
                      >
                        <OptIcon size={13} />
                      </button>
                    );
                  })}
                </div>
                <div className="h-4 w-px bg-gray-200" />
                <div className="flex items-center gap-1.5">
                  {WORKFLOW_COLOR_PALETTE.map((col) => (
                    <button
                      key={col}
                      onClick={() => updateChannel(i, { color: col })}
                      title={col}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: col }}
                    >
                      {c.color === col && <Check size={12} className="text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={addChannel} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700">
        <Plus size={14} /> {t("Add channel")}
      </button>
    </div>
  );
}

function UsersPanel() {
  const { t } = useI18n();
  const [users, setUsers] = useLocalStorage("cms.settings.users", () =>
    seedUsers().map((u, i) => ({ ...u, role: ROLES[i % ROLES.length] }))
  );
  const [selected, setSelected] = useState(new Set());

  function setRole(id, role) {
    setUsers(users.map((u) => (u.id === id ? { ...u, role } : u)));
  }

  const columns = [
    {
      key: "name",
      header: "Name",
      sortValue: (r) => r.name,
      render: (r) => (
        <span className="inline-flex items-center gap-2.5">
          <Avatar user={r} size={24} />
          <span>
            <div className="font-medium text-gray-900">{r.name}</div>
            <div className="text-xs text-gray-400">{r.email}</div>
          </span>
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (r) => (
        <select
          value={r.role}
          onChange={(e) => setRole(r.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>{t(role)}</option>
          ))}
        </select>
      ),
    },
  ];

  return (
    <div className="rounded-lg border border-gray-300 bg-white">
      <DataTable columns={columns} rows={users} selected={selected} onSelectedChange={setSelected} />
    </div>
  );
}

// Everything the prototype stores lives in this browser's localStorage, so a
// different browser or site (e.g. the deployed copy) starts from the sample
// data. Export / import moves a whole workspace between them as one file.
const DATA_FILE = "cms-prototype-data";

function DataPanel() {
  const { t } = useI18n();
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null); // parsed import awaiting confirmation
  const [error, setError] = useState("");


  function exportData() {
    const data = {};
    for (const k of sharedKeys()) {
      try { data[k] = JSON.parse(localStorage.getItem(k)); } catch { /* skip unreadable value */ }
    }
    const blob = new Blob([JSON.stringify({ app: DATA_FILE, version: 1, exportedAt: new Date().toISOString(), data })], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${DATA_FILE}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function chooseFile(file) {
    setError("");
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const entries = Object.entries(parsed?.data ?? {}).filter(([k]) => isSharedKey(k));
      if (parsed?.app !== DATA_FILE || entries.length === 0) throw new Error("not a data file");
      setPending({ name: file.name, entries, entryCount: parsed.data["cms.entries"]?.length ?? 0, typeCount: parsed.data["cms.contentTypes"]?.length ?? 0 });
    } catch {
      setError(t("That isn't a data file exported from this prototype."));
    }
  }

  async function importData() {
    try {
      // Replace, not merge: anything the file doesn't hold falls back to the sample data.
      for (const k of sharedKeys()) localStorage.removeItem(k);
      for (const [k, v] of pending.entries) localStorage.setItem(k, JSON.stringify(v));
    } catch {
      setPending(null);
      setError(t("Not enough browser storage to import this file."));
      return;
    }
    // With a shared workspace connected, the imported content becomes the shared copy.
    if (isSyncEnabled()) { markDirty(); await overwriteShared(); }
    window.location.reload();
  }

  const button = "flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50";
  return (
    <div className="max-w-lg space-y-5">
      <p className="text-sm text-gray-600">
        {t("Content, content types, taxonomies, media and settings are stored in this browser only. To get the same workspace in another browser or on the deployed site, export it here and import the file there.")}
      </p>
      <div className="flex items-center gap-2">
        <button onClick={exportData} className={button}><Download size={14} /> {t("Export data")}</button>
        <button onClick={() => fileRef.current?.click()} className={button}><Upload size={14} /> {t("Import data")}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { chooseFile(e.target.files[0]); e.target.value = ""; }} />
      </div>
      {error && <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">{error}</p>}

      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={t("Replace everything in this browser?")}
        footer={
          <>
            <button onClick={() => setPending(null)} className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100">{t("Cancel")}</button>
            <button onClick={importData} className="rounded-md bg-gray-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">{t("Replace and reload")}</button>
          </>
        }
      >
        {pending && t("{file} holds {entries} content items and {types} content types. Importing replaces all content, types, taxonomies, media and settings currently in this browser. This can't be undone.", { file: pending.name, entries: pending.entryCount, types: pending.typeCount })}
        {pending && isSyncEnabled() && <p className="mt-2 font-medium text-gray-800">{t("It also replaces the shared workspace for everyone who uses it.")}</p>}
      </Modal>
    </div>
  );
}

function ApiKeysPanel() {
  const columns = [
    { key: "name", header: "Name", render: (r) => <span className="font-medium text-gray-900">{r.name}</span> },
    { key: "prefix", header: "Key", render: (r) => <code className="text-xs text-gray-500">{r.prefix}</code> },
    { key: "createdAt", header: "Created", render: (r) => <span className="text-gray-500">{r.createdAt}</span> },
    { key: "lastUsed", header: "Last used", render: (r) => <span className="text-gray-500">{r.lastUsed}</span> },
  ];
  return (
    <div className="rounded-lg border border-gray-300 bg-white">
      <DataTable columns={columns} rows={API_KEYS} selectable={false} />
    </div>
  );
}

export default function Settings() {
  const { t } = useI18n();
  const [tab, setTab] = useState("general");

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-56 shrink-0 border-r border-gray-300 bg-white p-3">
        <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-gray-400">{t("Settings")}</p>
        <div className="space-y-2">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm ${
                tab === tb.id ? "bg-gray-200 font-medium text-gray-900" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {t(tb.label)}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto p-6">
        <h1 className="mb-4 text-xl font-semibold text-gray-900">{t(TABS.find((tb) => tb.id === tab)?.label)}</h1>
        {tab === "general" && <GeneralPanel />}
        {tab === "workflow" && <WorkflowPanel />}
        {tab === "channels" && <ChannelsPanel />}
        {tab === "users" && <UsersPanel />}
        {tab === "api" && <ApiKeysPanel />}
        {tab === "data" && <DataPanel />}
      </div>
    </div>
  );
}
