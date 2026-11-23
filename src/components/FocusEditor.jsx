import { useRef, useState } from "react";
import { Crosshair, Copy, Check, RotateCcw } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { CROP_FORMATS, focusOf, isDefaultFocus, objectPosition, toFocus, DEFAULT_FOCUS } from "../lib/focus";

// Sets the focus point of an image and shows what the picture looks like cropped
// to the formats used most on the website and in the app.
//
// Click or drag on the picture to move the point; the arrow keys nudge it. It is
// saved when the pointer is released. The previews use the same CSS the website
// would: `object-fit: cover` with `object-position` at the focus point.
export default function FocusEditor({ item, alt, onChange }) {
  const { t } = useI18n();
  const saved = focusOf(item);
  const [dragging, setDragging] = useState(null); // the point while it is being dragged
  const [copied, setCopied] = useState(false);
  const imgRef = useRef(null);
  const focus = dragging ?? saved;

  const pointFrom = (e) => {
    const r = imgRef.current.getBoundingClientRect();
    return toFocus(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
  };

  function down(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(pointFrom(e));
  }
  function move(e) {
    if (dragging) setDragging(pointFrom(e));
  }
  function up(e) {
    if (!dragging) return;
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

  const css = `object-position: ${objectPosition(focus)};`;
  async function copy() {
    try { await navigator.clipboard.writeText(css); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-sm font-semibold text-gray-900">{t("Focus point")}</h2>
          <span className="text-xs text-gray-500">{t("Click or drag on the image to choose what must stay visible when it is cropped.")}</span>
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
            <button
              type="button"
              onKeyDown={key}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={`${t("Focus point")} ${focus.x}% ${focus.y}%`}
              style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
              className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#fff] bg-black/35 text-[#fff] shadow-[0_0_0_1.5px_rgba(0,0,0,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fff]"
            >
              <Crosshair size={16} />
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-600">
          <code className="rounded bg-gray-100 px-2 py-1">{css}</code>
          <button type="button" onClick={copy} className="flex h-7 items-center gap-1 rounded-md px-2 font-medium text-gray-600 hover:bg-gray-100">
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? t("Copied") : t("Copy CSS")}
          </button>
          {!isDefaultFocus(focus) && (
            <button type="button" onClick={() => onChange(DEFAULT_FOCUS)} className="flex h-7 items-center gap-1 rounded-md px-2 font-medium text-gray-600 hover:bg-gray-100">
              <RotateCcw size={13} /> {t("Reset to centre")}
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">{t("Crop preview")}</h2>
        <div className="flex items-start gap-4">
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
    </div>
  );
}
