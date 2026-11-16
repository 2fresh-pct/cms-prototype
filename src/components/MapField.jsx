import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, X, MapPinned } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { geocode, reverseGeocode } from "../lib/geocode";

// The value of a Map field: { address, lat, lng } (lat and lng are null while no
// pin is placed). Shown as a square card: the address on top, the map with its pin
// in the middle, the coordinates at the bottom. Type an address and press Enter and
// the pin goes there; click the map or drag the pin to adjust it by hand. With
// `readOnly` it is a still picture of the same.

const PRAGUE = [50.0755, 14.4378];
const round = (n) => Math.round(n * 1e6) / 1e6;
const hasPin = (v) => typeof v?.lat === "number" && typeof v?.lng === "number";

// The pin: a drop in the theme's gold, drawn as SVG so no image files are needed.
const PIN = L.divIcon({
  className: "map-pin",
  iconSize: [30, 40],
  iconAnchor: [15, 38],
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 1C7.3 1 1 7.2 1 14.9c0 10.2 14 24.1 14 24.1s14-13.9 14-24.1C29 7.2 22.7 1 15 1z" fill="#a87708" stroke="#523904" stroke-width="2"/>
    <circle cx="15" cy="15" r="5.5" fill="#fffcf4"/></svg>`,
});

export default function MapField({ value, onChange, readOnly = false }) {
  const { t } = useI18n();
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  const [text, setText] = useState(value?.address ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  // What is typed follows the saved address when that changes (a search result, a restored version).
  useEffect(() => { setText(value?.address ?? ""); }, [value?.address]);

  const place = (lat, lng) => {
    const { value: v, onChange: change } = latest.current;
    change({ address: v?.address ?? "", lat: round(lat), lng: round(lng) });
  };

  // The map itself, made once.
  useEffect(() => {
    const el = box.current;
    const first = latest.current.value;
    const m = L.map(el, {
      center: hasPin(first) ? [first.lat, first.lng] : PRAGUE,
      zoom: hasPin(first) ? 16 : 12,
      zoomControl: !readOnly,
      attributionControl: true,
      dragging: !readOnly,
      touchZoom: !readOnly,
      doubleClickZoom: !readOnly,
      boxZoom: false,
      keyboard: !readOnly,
      scrollWheelZoom: false, // the page scrolls over the map until it is clicked
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    if (!readOnly) {
      m.on("click", (e) => place(e.latlng.lat, e.latlng.lng));
      m.on("focus", () => m.scrollWheelZoom.enable());
      m.on("blur", () => m.scrollWheelZoom.disable());
    }
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(el);
    map.current = m;
    return () => { resize.disconnect(); m.remove(); map.current = null; marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // The pin follows the value.
  const lat = value?.lat;
  const lng = value?.lng;
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (typeof lat !== "number" || typeof lng !== "number") {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = L.marker([lat, lng], { icon: PIN, draggable: !readOnly, keyboard: false }).addTo(m);
      if (!readOnly) marker.current.on("dragend", () => { const p = marker.current.getLatLng(); place(p.lat, p.lng); });
    } else {
      marker.current.setLatLng([lat, lng]);
    }
  }, [lat, lng, readOnly]);

  async function search() {
    const query = text.trim();
    if (!query || busy) return;
    setBusy(true);
    setNote("");
    try {
      const hit = await geocode(query);
      if (!hit) { setNote(t("Address not found")); return; }
      latest.current.onChange({ address: hit.address, lat: round(hit.lat), lng: round(hit.lng) });
      map.current?.setView([hit.lat, hit.lng], Math.max(map.current.getZoom(), 16));
    } catch {
      setNote(t("The map search is unavailable"));
    } finally {
      setBusy(false);
    }
  }

  // The nearest address to the pin, for when the pin was moved by hand.
  async function addressAtPin() {
    if (!hasPin(value) || busy) return;
    setBusy(true);
    setNote("");
    try {
      const address = await reverseGeocode(value.lat, value.lng);
      if (!address) setNote(t("No address at the pin"));
      else latest.current.onChange({ ...latest.current.value, address });
    } catch {
      setNote(t("The map search is unavailable"));
    } finally {
      setBusy(false);
    }
  }

  const pinned = hasPin(value);
  const smallButton = "flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="w-full max-w-[33.8rem]">
      <div className="flex aspect-square flex-col overflow-hidden rounded-md border border-gray-300 bg-[#fff]">
        <div className="shrink-0 border-b border-gray-300 p-2">
          {readOnly ? (
            <p className="min-h-9 px-1 py-2 text-sm text-gray-900">{value?.address || <span className="text-gray-400">—</span>}</p>
          ) : (
            <div className="flex items-center gap-1">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={() => { if (text !== (value?.address ?? "")) latest.current.onChange({ ...(latest.current.value ?? {}), address: text, lat: value?.lat ?? null, lng: value?.lng ?? null }); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
                placeholder={t("Type an address and press Enter")}
                aria-label={t("Address")}
                className="h-9 min-w-0 flex-1 rounded-md border border-gray-300 bg-[#fff] px-3 text-sm focus:border-violet-400 focus:outline-none"
              />
              <button type="button" onClick={search} disabled={busy || !text.trim()} aria-label={t("Find on the map")} title={t("Find on the map")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-40">
                <Search size={16} />
              </button>
            </div>
          )}
          {note && <p className="px-1 pt-1 text-xs text-red-700">{note}</p>}
        </div>

        {/* isolate: the map's own layers use high z-indexes that must not rise over the sticky tabs */}
        <div className="relative isolate min-h-0 flex-1">
          <div ref={box} className="absolute inset-0 bg-gray-100" />
          {!readOnly && !pinned && (
            <p className="pointer-events-none absolute inset-x-0 top-3 z-[500] mx-auto w-fit rounded-full bg-[#fff] px-3 py-1 text-xs font-medium text-gray-900 shadow ring-1 ring-gray-300">
              {t("Click the map to place the pin")}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-300 px-3 py-2">
          <p className="min-w-0 truncate font-mono text-xs text-gray-900" title={pinned ? `${value.lat}, ${value.lng}` : undefined}>
            {pinned ? `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}` : t("No pin yet")}
          </p>
          {!readOnly && pinned && (
            <div className="flex shrink-0 items-center gap-0.5">
              <button type="button" onClick={addressAtPin} disabled={busy} className={smallButton} title={t("Use the address nearest to the pin")}>
                <MapPinned size={13} /> {t("Address at pin")}
              </button>
              <button
                type="button"
                onClick={() => latest.current.onChange({ ...(latest.current.value ?? {}), lat: null, lng: null })}
                className={smallButton}
                aria-label={t("Remove pin")}
                title={t("Remove pin")}
              >
                <X size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
