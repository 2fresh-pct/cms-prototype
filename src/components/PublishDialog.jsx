import { useState } from "react";
import { Smartphone, Globe, Radio, Tv, Mail, MessageSquare } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useLocalStorage } from "../lib/storage";
import { orderLocales } from "../lib/locales";
import { LOCALE_LABELS, LOCALE_NAMES } from "../lib/seed";
import Modal from "./Modal";
import DatePicker from "./DatePicker";
import StatusPill from "./StatusPill";

const CHANNEL_ICONS = { smartphone: Smartphone, globe: Globe, radio: Radio, tv: Tv, mail: Mail, "message-square": MessageSquare };

// Tomorrow 09:00, in the format a datetime-local input takes.
function defaultScheduleValue() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// The Publish dialog, used for one content item (from its page) and for a bunch
// (from the content list's Actions): publish now or schedule, the channels, and
// which language versions.
//
//   channels          all channels ({ id, name, icon })
//   initialChannelIds channels ticked when the dialog opens
//   languageRows      one per language: { locale, versionIds, pill?, count? }.
//                     `versionIds` are the entries that language publishes (none:
//                     the row is shown as empty); `pill` shows a status pill
//                     ({ name, color }) and `count` a number, on the right.
//   initialVersionIds entries ticked when it opens
//   texts             { now, schedule }: the line above the channels
//   emptyLabel        what an empty language row says
//   usedFor           optional; (versionIds) => the not yet published items those
//                     versions use ([{ id, title, typeName, how }]). When there are
//                     some, a checkbox offers to publish them too.
//   onConfirm         called with { mode: "now" | "schedule", scheduledAt,
//                     channelIds, versionIds, includeUsed }
export default function PublishDialog({
  open, onClose, title, channels, initialChannelIds, languageRows, initialVersionIds, texts, emptyLabel, usedFor, onConfirm,
}) {
  const { t } = useI18n();
  const [defaultLocale] = useLocalStorage("cms.settings.defaultLocale", "en");
  const [mode, setMode] = useState("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [channelIds, setChannelIds] = useState([]);
  const [versionIds, setVersionIds] = useState([]);
  const [includeUsed, setIncludeUsed] = useState(false);

  // Fresh choices each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setMode("now");
    setScheduledAt(defaultScheduleValue());
    setChannelIds(initialChannelIds);
    setVersionIds(initialVersionIds);
    setIncludeUsed(false);
  }
  if (!open && wasOpen) setWasOpen(false);

  const toggle = (list, setList, id) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const used = open && usedFor ? usedFor(versionIds) : [];
  const canConfirm = channelIds.length > 0 && versionIds.length > 0 && (mode !== "schedule" || Boolean(scheduledAt));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="max-w-xl"
      footer={
        <>
          <button onClick={onClose} className="rounded-md h-9 px-3 text-sm font-medium text-gray-600 hover:bg-gray-100">
            {t("Cancel")}
          </button>
          <button
            onClick={() => canConfirm && onConfirm({ mode, scheduledAt, channelIds, versionIds, includeUsed: includeUsed && used.length > 0 })}
            disabled={!canConfirm}
            className="rounded-md bg-violet-600 h-9 px-3 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {(mode === "schedule" ? t("Schedule") : t("Publish")) + (versionIds.length > 1 ? ` (${versionIds.length})` : "")}
          </button>
        </>
      }
    >
      <div className="mb-4 flex gap-2">
        {[["now", "Publish now"], ["schedule", "Schedule"]].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={`flex-1 rounded-md h-9 px-3 text-sm font-medium ring-1 ring-inset transition-colors ${
              mode === value ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-gray-600 ring-gray-300 hover:bg-gray-50"
            }`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {mode === "schedule" && (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">{t("Publish date & time")}</label>
          <div className="flex gap-2">
            <DatePicker
              value={scheduledAt.slice(0, 10)}
              onChange={(date) => setScheduledAt(date ? `${date}T${scheduledAt.slice(11, 16) || "09:00"}` : "")}
              ariaLabel={t("Publish date & time")}
              className="h-9 min-w-0 flex-1 px-3"
            />
            <input
              type="time"
              value={scheduledAt.slice(11, 16)}
              onChange={(e) => setScheduledAt(scheduledAt ? `${scheduledAt.slice(0, 10)}T${e.target.value}` : "")}
              disabled={!scheduledAt}
              aria-label={t("Time")}
              className="w-28 rounded-md border border-gray-300 bg-[#fff] h-9 px-3 text-sm focus:border-violet-400 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
      )}

      <p className="mb-3">{mode === "schedule" ? t(texts.schedule) : t(texts.now)}</p>
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t("Channels")}</p>
          {channelIds.length < channels.length && (
            <button onClick={() => setChannelIds(channels.map((c) => c.id))} className="text-xs font-medium text-violet-600 hover:underline">
              {t("Select all")}
            </button>
          )}
        </div>
        <div className="space-y-1">
          {channels.map((c) => {
            const Icon = CHANNEL_ICONS[c.icon] || Radio;
            return (
              <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-md border border-gray-300 h-9 px-3 text-sm text-gray-800 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={channelIds.includes(c.id)}
                  onChange={() => toggle(channelIds, setChannelIds, c.id)}
                  className="h-4 w-4 rounded border-gray-300 accent-violet-600"
                />
                <Icon size={14} className="text-gray-500" />
                {c.name}
              </label>
            );
          })}
        </div>
        {channelIds.length === 0 && <p className="mt-1.5 text-xs text-red-600">{t("Select at least one channel")}</p>}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">{t("Languages")}</p>
        <div className="space-y-1">
          {orderLocales(defaultLocale).map((l) => {
            const row = languageRows.find((r) => r.locale === l);
            if (!row || row.versionIds.length === 0) {
              return (
                <div key={l} className="flex items-center gap-2.5 rounded-md border border-dashed border-gray-300 h-9 px-3 text-sm text-gray-400">
                  <span className="w-7 shrink-0 font-semibold">{LOCALE_LABELS[l]}</span>
                  {t(emptyLabel)}
                </div>
              );
            }
            const checked = row.versionIds.every((id) => versionIds.includes(id));
            return (
              <label key={l} className="flex cursor-pointer items-center gap-2.5 rounded-md border border-gray-300 h-9 px-3 text-sm text-gray-800 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setVersionIds(checked ? versionIds.filter((id) => !row.versionIds.includes(id)) : [...new Set([...versionIds, ...row.versionIds])])}
                  className="h-4 w-4 rounded border-gray-300 accent-violet-600"
                />
                <span className="w-5 shrink-0 font-semibold text-gray-500">{LOCALE_LABELS[l]}</span>
                <span className="flex-1">{t(LOCALE_NAMES[l] ?? l)}</span>
                {row.count != null && <span className="rounded-full bg-gray-100 px-2 text-xs text-gray-600">{row.count}</span>}
                {row.pill && <StatusPill status={row.pill.name} color={row.pill.color} />}
              </label>
            );
          })}
        </div>
        {versionIds.length === 0 && <p className="mt-1.5 text-xs text-red-600">{t("Select at least one language")}</p>}
      </div>

      {used.length > 0 && (
        <div className="mt-4 rounded-md border border-gray-300 px-3 py-2.5">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={includeUsed}
              onChange={(e) => setIncludeUsed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-violet-600"
            />
            <span>{t("Also publish the {n} content items used in it", { n: used.length })}</span>
          </label>
          <ul className="mt-2 space-y-0.5 pl-6 text-xs text-gray-600">
            {used.slice(0, 6).map((u) => (
              <li key={u.id} className="truncate">
                <span className="font-medium text-gray-800">{u.title}</span>
                <span className="text-gray-400"> · {u.typeName} · {t(u.how === "embedded" ? "Embedded in text" : "Linked")}</span>
              </li>
            ))}
            {used.length > 6 && <li className="text-gray-400">{t("and {n} more", { n: used.length - 6 })}</li>}
          </ul>
        </div>
      )}
    </Modal>
  );
}
