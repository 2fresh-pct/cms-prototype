import { useEffect, useRef, useState } from "react";
import { ChevronDown, Eye } from "lucide-react";
import { useI18n } from "../lib/i18n";

export default function PreviewButton({ entryId, channels, defaultChannelId }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  function openPreview(channelId) {
    window.open(`/preview/${channelId}/${entryId}`, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  return (
    <div className="relative inline-flex" ref={ref}>
      <div className="inline-flex overflow-hidden rounded-md ring-1 ring-inset ring-gray-300">
        <button
          onClick={() => openPreview(defaultChannelId)}
          className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-gray-700 hover:bg-gray-300 hover:text-gray-900"
        >
          <Eye size={14} /> {t("Preview")}
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center border-l border-gray-300 px-2 text-gray-500 hover:bg-gray-300 hover:text-gray-900"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-gray-300 bg-white p-1 wf-pop">
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => openPreview(c.id)}
              className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm text-gray-700 hover:bg-gray-200 hover:text-gray-900"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
