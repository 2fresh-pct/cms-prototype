import { List, Clock, CalendarClock, Folder } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { typeIcon } from "../lib/typeIcons";

function Item({ icon: Icon, label, count, active, onClick, dim, color }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm ${
        active ? "bg-gray-200 font-medium text-gray-900" : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      {color ? (
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        Icon && <Icon size={15} className={dim ? "text-gray-400" : "text-gray-500"} />
      )}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-xs text-gray-400">{count}</span>}
    </button>
  );
}

export default function Sidebar({
  allLabel = "All content",
  statusGroupLabel = "Status",
  statuses,
  typeGroupLabel = "Content type",
  typeItems,
  channelGroupLabel = "Channel",
  channelItems,
  filter,
  onFilter,
}) {
  const { t } = useI18n();
  const isAll = !filter.status && !filter.typeId && !filter.channelId && filter.view === "all";
  const reset = { status: null, typeId: null, channelId: null };

  return (
    <aside className="w-60 shrink-0 space-y-5 overflow-y-auto border-r border-gray-300 bg-white p-3">
      <div className="space-y-0.5">
        <Item icon={List} label={t(allLabel)} active={isAll} onClick={() => onFilter({ view: "all", ...reset })} />
        <Item icon={Clock} label={t("Recent")} active={filter.view === "recent"} onClick={() => onFilter({ view: "recent", ...reset })} />
        <Item icon={CalendarClock} label={t("Scheduled")} active={filter.view === "scheduled"} onClick={() => onFilter({ view: "scheduled", ...reset })} />
      </div>

      <div>
        <p className="px-2 pb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">{t(statusGroupLabel)}</p>
        <div className="space-y-0.5">
          {statuses.map((s) => (
            <Item
              key={s.id ?? s.name}
              icon={Folder}
              color={s.color}
              label={t(s.name)}
              count={s.count}
              active={filter.status === (s.id ?? s.name)}
              onClick={() => onFilter({ view: "status", ...reset, status: s.id ?? s.name })}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="px-2 pb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">{t(typeGroupLabel)}</p>
        <div className="space-y-0.5">
          {typeItems.map((ti) => (
            <Item
              key={ti.id}
              icon={ti.icon ? typeIcon(ti.icon) : Folder}
              label={t(ti.name)}
              count={ti.count}
              active={filter.typeId === ti.id}
              onClick={() => onFilter({ view: "type", ...reset, typeId: ti.id })}
            />
          ))}
        </div>
      </div>

      {channelItems && (
        <div>
          <p className="px-2 pb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">{t(channelGroupLabel)}</p>
          <div className="space-y-0.5">
            {channelItems.map((c) => (
              <Item
                key={c.id}
                icon={Folder}
                color={c.color}
                label={c.name}
                count={c.count}
                active={filter.channelId === c.id}
                onClick={() => onFilter({ view: "channel", ...reset, channelId: c.id })}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
