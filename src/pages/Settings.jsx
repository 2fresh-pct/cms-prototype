import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import { ArrowRight, ArrowUp, ArrowDown, Trash2, Plus, Check, Lock, Smartphone, Globe, Radio, Tv, Mail, MessageSquare, Download, Upload } from "lucide-react";
import { useLocalStorage } from "../lib/storage";
import { useI18n, UI_LANGUAGES } from "../lib/i18n";
import { seedUsers, DEFAULT_WORKFLOW_STEPS, normalizeWorkflowSteps, WORKFLOW_COLOR_PALETTE, DEFAULT_CHANNELS, normalizeChannels } from "../lib/seed";
import DataTable from "../components/DataTable";
import Avatar from "../components/Avatar";
import Modal from "../components/Modal";
import { THEMES, getTheme, setTheme } from "../lib/theme";
import SaveIndicator from "../components/SaveIndicator";
import { getBackup, isSharedKey, isSyncEnabled, markDirty, overwriteShared, restoreBackup, sharedKeys } from "../lib/sync";

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

// Settings are edited as a draft and only stored when Save is pressed: nothing
// autosaves. `useSettingsDraft` holds the draft for one stored value;
// `SettingsForm` shows the title, the unsaved/saved indicator and the Save and
// Discard buttons. The page-level guard (see Settings) asks before a tab switch,
// navigation or closing the tab throws a draft away.
const IDENTITY = (v) => v;

function useSettingsDraft(key, initial, normalize = IDENTITY) {
  const [raw, setRaw] = useLocalStorage(key, initial);
  const saved = useMemo(() => normalize(raw), [raw, normalize]);
  const [draft, setDraftState] = useState(saved);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  return {
    draft,
    setDraft: (next) => { setDraftState(next); setJustSaved(false); },
    dirty,
    justSaved,
    // Written straight to storage too: saving from the leave dialog unmounts this
    // page in the same step, before the storage hook's own effect would run.
    save: () => {
      localStorage.setItem(key, JSON.stringify(draft));
      setRaw(draft);
      markDirty();
      setJustSaved(true);
    },
    discard: () => { setDraftState(saved); setJustSaved(false); },
  };
}

function SettingsForm({ title, form, guardRef, children }) {
  const { t } = useI18n();
  guardRef.current = form;
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900">{t(title)}</h1>
          <SaveIndicator status={form.dirty ? "unsaved" : form.justSaved ? "saved" : null} />
        </div>
        <div className="flex items-center gap-2">
          {form.dirty && (
            <button onClick={form.discard} className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100">
              {t("Discard changes")}
            </button>
          )}
          <button
            onClick={form.save}
            disabled={!form.dirty}
            className="rounded-md bg-gray-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("Save")}
          </button>
        </div>
      </div>
      {children}
    </>
  );
}

// Miniature of each look, drawn with fixed colours so it doesn't follow the
// active theme.
const THEME_SWATCH = {
  wireframe: { page: "#f5f5f5", bar: "#ffffff", line: "#d4d4d4", button: "#2e2e2e", card: "#ffffff", border: "#d4d4d4" },
  golden: { page: "#faf6ec", bar: "#fffcf4", line: "#d8c9a8", button: "#a87708", card: "#fffcf4", border: "#d8c9a8", shadow: "0 3px 10px rgba(92,64,10,.22)", gradient: "linear-gradient(135deg,#b8860b,#946a06)" },
};

function ThemePreview({ id }) {
  const c = THEME_SWATCH[id];
  return (
    <div aria-hidden className="h-20 overflow-hidden rounded-md border" style={{ background: c.page, borderColor: c.border }}>
      <div className="flex h-4 items-center gap-1 px-2" style={{ background: c.bar, borderBottom: `1px solid ${c.border}` }}>
        <span className="h-1.5 w-1.5 rounded-sm" style={{ background: c.button }} />
        <span className="h-1 w-6 rounded" style={{ background: c.line }} />
        <span className="h-1 w-6 rounded" style={{ background: c.line }} />
      </div>
      <div className="flex gap-1.5 p-2">
        <div className="flex-1 space-y-1 rounded p-1.5" style={{ background: c.card, border: `1px solid ${c.border}`, boxShadow: c.shadow ?? "none" }}>
          <span className="block h-1 w-10 rounded" style={{ background: c.line }} />
          <span className="block h-1 w-14 rounded" style={{ background: c.line }} />
          <span className="mt-1 block h-3 w-8 rounded" style={{ background: c.button, backgroundImage: c.gradient ?? "none" }} />
        </div>
        <div className="w-8 rounded" style={{ background: c.card, border: `1px solid ${c.border}` }} />
      </div>
    </div>
  );
}

// The look is remembered in this browser only; chosen here, applied on Save.
function ThemeChooser({ value, onChange }) {
  const { t } = useI18n();
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{t("Theme")}</label>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t("Theme")}>
        {THEMES.map((th) => {
          const active = value === th.id;
          return (
            <button
              key={th.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(th.id)}
              className={`rounded-lg border bg-white p-2 text-left ${active ? "border-gray-700 ring-2 ring-gray-800" : "border-gray-300 hover:border-gray-400"}`}
            >
              <ThemePreview id={th.id} />
              <p className="mt-2 text-sm font-medium text-gray-900">{t(th.name)}</p>
              <p className="text-xs text-gray-500">{t(th.description)}</p>
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-gray-500">{t("Saved in this browser only; other browsers keep their own theme.")}</p>
    </div>
  );
}

function GeneralPanel({ guardRef }) {
  const { t, lang, setLang } = useI18n();
  const [savedName, setSavedName] = useLocalStorage("cms.settings.workspaceName", "Cargo Workspace");
  const [savedLocale, setSavedLocale] = useLocalStorage("cms.settings.defaultLocale", "en");
  const savedTheme = getTheme();
  const saved = { name: savedName, locale: savedLocale, lang, theme: savedTheme };
  const [draft, setDraftState] = useState(saved);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch) => { setDraftState({ ...draft, ...patch }); setJustSaved(false); };

  const form = {
    dirty,
    justSaved,
    save: () => {
      localStorage.setItem("cms.settings.workspaceName", JSON.stringify(draft.name));
      localStorage.setItem("cms.settings.defaultLocale", JSON.stringify(draft.locale));
      setSavedName(draft.name);
      setSavedLocale(draft.locale);
      markDirty();
      // Only what was changed, so an untouched theme keeps following the default.
      if (draft.lang !== saved.lang) setLang(draft.lang);
      if (draft.theme !== saved.theme) setTheme(draft.theme);
      setJustSaved(true);
    },
    discard: () => { setDraftState(saved); setJustSaved(false); },
  };

  return (
    <SettingsForm title="General" form={form} guardRef={guardRef}>
      <div className="max-w-2xl space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("Workspace name")}</label>
          <input
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t("Default locale")}</label>
          <select
            value={draft.locale}
            onChange={(e) => set({ locale: e.target.value })}
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
            value={draft.lang}
            onChange={(e) => set({ lang: e.target.value })}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
          >
            {UI_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">{t("The language of the CMS menus and labels. Content languages are set separately.")}</p>
        </div>
        <ThemeChooser value={draft.theme} onChange={(theme) => set({ theme })} />
      </div>
    </SettingsForm>
  );
}

function WorkflowPanel({ guardRef }) {
  const { t } = useI18n();
  const form = useSettingsDraft("cms.settings.workflowSteps", DEFAULT_WORKFLOW_STEPS, normalizeWorkflowSteps);
  const steps = form.draft;
  const setSteps = form.setDraft;

  function updateStep(i, patch) {
    setSteps(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  // The first (Draft) and last (Published) steps are fixed; the steps between
  // them can be edited, reordered among themselves and removed.
  const lastIndex = steps.length - 1;
  const isFixed = (i) => i === 0 || i === lastIndex;

  function moveStep(i, dir) {
    const j = i + dir;
    if (isFixed(i) || j < 1 || j >= lastIndex) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  }

  function removeStep(i) {
    if (isFixed(i)) return;
    setSteps(steps.filter((_, idx) => idx !== i));
  }

  // New steps go just before Published.
  function addStep() {
    const step = { id: `step-${Date.now()}`, name: t("Step {n}", { n: steps.length }), color: WORKFLOW_COLOR_PALETTE[steps.length % WORKFLOW_COLOR_PALETTE.length] };
    setSteps([...steps.slice(0, lastIndex), step, steps[lastIndex]]);
  }

  return (
    <SettingsForm title="Workflow" form={form} guardRef={guardRef}>
    <div className="max-w-lg">
      <p className="mb-4 text-sm text-gray-500">
        {t("Define the stages content moves through between Draft and Published, in order, with a color for each. Draft and Published are fixed; content reaches Published only through the Publish action.")}
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
        {steps.map((s, i) => isFixed(i) ? (
          <div key={s.id} className="flex items-center gap-2 rounded-md border border-gray-300 bg-gray-50 p-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
              {i + 1}
            </span>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="flex-1 text-sm font-medium text-gray-800">{t(s.name)}</span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Lock size={12} /> {i === 0 ? t("Always the first step") : t("Always the last step")}
            </span>
          </div>
        ) : (
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
                disabled={i <= 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
              >
                <ArrowUp size={14} />
              </button>
              <button
                onClick={() => moveStep(i, 1)}
                disabled={i >= lastIndex - 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
              >
                <ArrowDown size={14} />
              </button>
              <button
                onClick={() => removeStep(i)}
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
    </SettingsForm>
  );
}

function ChannelsPanel({ guardRef }) {
  const { t } = useI18n();
  const form = useSettingsDraft("cms.settings.channels", DEFAULT_CHANNELS, normalizeChannels);
  const channels = form.draft;
  const setChannels = form.setDraft;

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
    <SettingsForm title="Channels" form={form} guardRef={guardRef}>
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
    </SettingsForm>
  );
}

function UsersPanel({ guardRef }) {
  const { t } = useI18n();
  const form = useSettingsDraft("cms.settings.users", () =>
    seedUsers().map((u, i) => ({ ...u, role: ROLES[i % ROLES.length] }))
  );
  const users = form.draft;
  const setUsers = form.setDraft;
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
    <SettingsForm title="Users & roles" form={form} guardRef={guardRef}>
      <div className="rounded-lg border border-gray-300 bg-white">
        <DataTable columns={columns} rows={users} selected={selected} onSelectedChange={setSelected} />
      </div>
    </SettingsForm>
  );
}

// Everything the prototype stores lives in this browser's localStorage, so a
// different browser or site (e.g. the deployed copy) starts from the sample
// data. Export / import moves a whole workspace between them as one file.
const DATA_FILE = "cms-prototype-data";

function DataPanel() {
  const { t, dateLocale } = useI18n();
  const backup = getBackup();
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

      {backup && (
        <div className="rounded-md border border-gray-300 bg-white p-3 text-sm text-gray-700">
          <p>
            {t("This browser had its own content ({n} items) until the shared workspace replaced it on {when}.", {
              n: backup.entries,
              when: new Date(backup.savedAt).toLocaleString(dateLocale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
            })}
          </p>
          <button onClick={restoreBackup} className={`${button} mt-2`}>{t("Restore that content")}</button>
        </div>
      )}

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
  const [pendingTab, setPendingTab] = useState(null);
  // The open form page reports its draft here (see SettingsForm), so tab
  // switches, in-app navigation and closing the tab can ask before losing it.
  const guardRef = useRef({ dirty: false });

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => Boolean(guardRef.current?.dirty) && currentLocation.pathname !== nextLocation.pathname
  );
  useEffect(() => {
    const warn = (e) => { if (guardRef.current?.dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function goToTab(id) {
    guardRef.current = { dirty: false };
    setTab(id);
  }
  function selectTab(id) {
    if (id === tab) return;
    if (guardRef.current?.dirty) setPendingTab(id);
    else goToTab(id);
  }

  const leaving = blocker.state === "blocked" || pendingTab !== null;
  function keepEditing() {
    blocker.reset?.();
    setPendingTab(null);
  }
  function leave() {
    if (pendingTab !== null) { const id = pendingTab; setPendingTab(null); goToTab(id); }
    else blocker.proceed?.();
  }
  const title = TABS.find((tb) => tb.id === tab)?.label;

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-56 shrink-0 border-r border-gray-300 bg-white p-3">
        <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-gray-400">{t("Settings")}</p>
        <div className="space-y-2">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => selectTab(tb.id)}
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
        {tab === "general" && <GeneralPanel guardRef={guardRef} />}
        {tab === "workflow" && <WorkflowPanel guardRef={guardRef} />}
        {tab === "channels" && <ChannelsPanel guardRef={guardRef} />}
        {tab === "users" && <UsersPanel guardRef={guardRef} />}
        {(tab === "api" || tab === "data") && <h1 className="mb-4 text-xl font-semibold text-gray-900">{t(title)}</h1>}
        {tab === "api" && <ApiKeysPanel />}
        {tab === "data" && <DataPanel />}
      </div>

      <Modal
        open={leaving}
        onClose={keepEditing}
        title={t("Save your changes?")}
        footer={
          <>
            <button onClick={keepEditing} className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100">
              {t("Keep editing")}
            </button>
            <button
              onClick={() => { guardRef.current?.discard?.(); leave(); }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              {t("Discard changes")}
            </button>
            <button
              onClick={() => { guardRef.current?.save?.(); leave(); }}
              className="rounded-md bg-gray-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              {t("Save changes")}
            </button>
          </>
        }
      >
        {t("You have unsaved changes in these settings.")}
      </Modal>
    </div>
  );
}
