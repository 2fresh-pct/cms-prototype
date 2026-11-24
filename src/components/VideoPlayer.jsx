import { useEffect, useState } from "react";
import { useI18n } from "../lib/i18n";
import { getVideo } from "../lib/videoStore";

// Plays an uploaded video. The file lives in this browser's IndexedDB (see
// lib/videoStore.js); in another browser only the poster frame is available.
export default function VideoPlayer({ item }) {
  const { t } = useI18n();
  const [url, setUrl] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    getVideo(item.id).then((blob) => {
      if (cancelled) return;
      if (!blob) { setMissing(true); return; }
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item.id]);

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{t("Video")}</h2>
      <div className="flex justify-center">
        {url ? (
          <video src={url} poster={item.src} controls preload="metadata" className="max-h-[26rem] max-w-full rounded-md border border-gray-300 bg-black" />
        ) : (
          <p className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
            {missing ? t("The video file is kept in the browser it was uploaded in. Only the preview frame is available here.") : t("Loading…")}
          </p>
        )}
      </div>
    </section>
  );
}
