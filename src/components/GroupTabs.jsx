import { useState } from "react";
import { useI18n } from "../lib/i18n";

// A tab bar for field groups. `tabs` are { id, label }; passing `onMove` makes
// the tabs draggable (except General, which always comes first). `trailing` is
// extra content after the tabs, e.g. an "Add group" button.
export default function GroupTabs({ tabs, active, onSelect, onMove, trailing, fixedId }) {
  const { t } = useI18n();
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  return (
    <div className="flex flex-wrap items-end gap-1 border-b border-gray-300" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const movable = onMove && tab.id !== fixedId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            draggable={Boolean(movable)}
            onClick={() => onSelect(tab.id)}
            onDragStart={(e) => { setDragId(tab.id); e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => { if (dragId && tab.id !== fixedId) { e.preventDefault(); if (overId !== tab.id) setOverId(tab.id); } }}
            onDrop={(e) => { e.preventDefault(); if (dragId && dragId !== tab.id) onMove(dragId, tab.id); setDragId(null); setOverId(null); }}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
            className={`-mb-px rounded-t-md border px-4 py-2 text-sm ${
              isActive
                ? "border-gray-300 border-b-white bg-white font-medium text-gray-900"
                : "border-transparent bg-gray-100 text-gray-600 hover:text-gray-900"
            } ${dragId === tab.id ? "opacity-40" : ""} ${overId === tab.id && dragId && dragId !== tab.id ? "ring-2 ring-gray-800" : ""} ${movable ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            {t(tab.label)}
          </button>
        );
      })}
      {trailing && <div className="mb-1 ml-1 flex items-center">{trailing}</div>}
    </div>
  );
}
