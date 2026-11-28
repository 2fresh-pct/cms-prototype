import { useEffect, useRef, useState } from "react";
import { Crosshair, RotateCcw, ScanFace, Loader2 } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { detectFaces, focusFromFaces } from "../lib/faces";
import { CROP_FORMATS, focusOf, isDefaultFocus, objectPosition, toFocus, DEFAULT_FOCUS } from "../lib/focus";

// Sets the focus point of an image and shows what the picture looks like cropped
// to the formats used most on the website and in the app.
//
// Click or drag on the picture to move the point; the arrow keys nudge it. It is
// saved when the pointer is released. The previews use the same CSS the website
// would: `object-fit: cover` with `object-position` at the focus point.
export default function FocusEditor({ item, alt, onChange, onLive, note }) {
  const { t } = useI18n();
  const saved = focusOf(item);
  const [dragging, setDragState] = useState(null); // the point while it is being dragged
  const dragRef = useRef(null); // the same, readable at once (events can arrive faster than a render)
  const setDragging = (point) => { dragRef.current = point; setDragState(point); };
  const imgRef = useRef(null);
  const focus = dragging ?? saved;
  // The point while it is dragged, for previews elsewhere on the page.
  useEffect(() => { onLive?.(dragging); }, [dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  // Face detection: boxes of the faces found, and what happened ("busy", "none", "error",
  // or the number found).
  const [faces, setFaces] = useState([]);
  const [scan, setScan] = useState(null);
  async function findFaces({ quiet } = {}) {
    setScan("busy");
    try {
      const found = await detectFaces(item.src);
      setFaces(found);
      const point = focusFromFaces(found);
      if (point) onChange(point);
      else if (!item.focus) onChange(DEFAULT_FOCUS); // looked, found none: don't look again on every visit
      setScan(found.length ? found.length : "none");
    } catch {
      setScan(quiet ? null : "error");
    }
  }
  // A picture that has never had a focus point gets one from its faces when it is opened.
  const asked = useRef(false);
  useEffect(() => {
    if (item.focus || asked.current) return;
    asked.current = true;
    findFaces({ quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Grabbing the point itself moves it from where it is (it does not jump under the
  // pointer); clicking elsewhere on the picture puts it there.
  const grab = useRef({ x: 0, y: 0 });
  const pointFrom = (e) => {
    const r = imgRef.current.getBoundingClientRect();
    return toFocus(((e.clientX - r.left) / r.width) * 100 + grab.current.x, ((e.clientY - r.top) / r.height) * 100 + grab.current.y);
  };

  function down(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = { x: 0, y: 0 };
    if (e.target.closest?.("[data-focus-point]")) {
      const at = pointFrom(e);
      grab.current = { x: saved.x - at.x, y: saved.y - at.y };
    }
    setDragging(pointFrom(e));
  }
  function move(e) {
    if (dragRef.current) setDragging(pointFrom(e));
  }
  function up(e) {
    if (!dragRef.current) return;
    const next = pointFrom(e);
    setDragging(null);
    if (next.x !== saved.x || next.y !== saved.y) onChange(next);
  }
  function key(e) {
    const step = e.shiftKey ? 10 : 1;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    onChange(toFocus(saved.x + d[0], saved.y + d[1]));
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-sm font-semibold text-gray-900">{t("Focus point")}</h2>
          <span className="text-xs text-gray-500">{t("Click or drag on the image to choose what must stay visible when it is cropped.")}</span>
          {note && <span className="ml-auto text-xs text-gray-400">{note}</span>}
        </div>
        <div className="flex justify-center">
          <div
            className="relative inline-block cursor-crosshair touch-none select-none leading-none"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => setDragging(null)}
          >
            <img
              ref={imgRef}
              src={item.src}
              alt={alt}
              draggable={false}
              className="block max-h-[26rem] max-w-full rounded-md border border-gray-300 object-contain"
            />
            {faces.map((f, i) => (
              <span
                key={i}
                aria-hidden
                style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%` }}
                className="pointer-events-none absolute rounded-sm border-2 border-dashed border-[#fff] shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
              />
            ))}
            <button
              type="button"
              onKeyDown={key}
              data-focus-point
              aria-label={`${t("Focus point")} ${focus.x}% ${focus.y}%`}
              style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
              className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full active:cursor-grabbing border-2 border-[#fff] bg-black/35 text-[#fff] shadow-[0_0_0_1.5px_rgba(0,0,0,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fff]"
            >
              <Crosshair size={16} />
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-600">
          <button
            type="button"
            onClick={() => findFaces()}
            disabled={scan === "busy"}
            className="flex h-7 items-center gap-1 rounded-md px-2 font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
          >
            {scan === "busy" ? <Loader2 size={13} className="animate-spin" /> : <ScanFace size={13} />} {t("Find faces")}
          </button>
          {!isDefaultFocus(focus) && (
            <button type="button" onClick={() => onChange(DEFAULT_FOCUS)} className="flex h-7 items-center gap-1 rounded-md px-2 font-medium text-gray-600 hover:bg-gray-100">
              <RotateCcw size={13} /> {t("Reset to centre")}
            </button>
          )}
        </div>
        {(scan === "none" || scan === "error") && (
          <p role="status" className="mt-2 text-center text-xs text-gray-500">
            {scan === "none" ? t("No face found. The focus point stays where it is.") : t("Face detection could not run. Set the focus point by hand.")}
          </p>
        )}
      </section>
    </div>
  );
}

// The picture cropped to the formats used most, at the given focus point.
export function CropPreview({ item, focus }) {
  const { t } = useI18n();
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{t("Crop preview")}</h2>
      <div className="flex items-start gap-3">
        {CROP_FORMATS.map((f) => (
          <figure key={f.id} style={{ flex: `${f.w} 1 0` }} className="min-w-0">
            <img
              src={item.src}
              alt=""
              draggable={false}
              style={{ aspectRatio: `${f.w} / ${f.h}`, objectPosition: objectPosition(focus) }}
              className="block w-full rounded-md border border-gray-300 object-cover"
            />
            <figcaption className="mt-1.5 text-xs font-medium text-gray-700">{f.label}</figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-400">{t("The formats used most on the website and in the app. The same crop is used wherever the image is shown.")}</p>
    </section>
  );
}
