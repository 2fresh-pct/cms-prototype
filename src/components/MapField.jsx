import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, MapPinned } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { geocode, reverseGeocode, suggest } from "../lib/geocode";

// The value of a Map field: { address, lat, lng } (lat and lng are null while no
// pin is placed). Shown as a card: the address on top, the pin's coordinates under
// it, followed in brackets by the address those coordinates stand for (looked up
// again whenever the pin moves; it is not saved, and does not replace the address
// above), with "use the address at the pin" and "remove pin", then the map with its
// pin. The address is typed as "Staroměstské náměstí 1/3, 110 00, Staré Město,
// Praha 1"; while typing, matching places are offered, and choosing one sets the
// address and puts the pin there (Enter with nothing chosen looks up the best match).
// Click the map or drag the pin to adjust it by hand. With `readOnly` it is a still picture.

const PRAGUE = [50.0755, 14.4378];
const round = (n) => Math.round(n * 1e6) / 1e6;
const hasPin = (v) => typeof v?.lat === "number" && typeof v?.lng === "number";

// The address found for a pin ("lat,lng" -> address, "" for none), so a place is
// looked up once however many times it is shown.
const ADDRESS_AT = new Map();
const pinKey = (lat, lng) => `${lat},${lng}`;

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
  // Places that match what is typed in the address, shown under it: { address, lat, lng }.
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typing = useRef({ timer: null, ctrl: null });
  // The address the pin stands for: { status: "loading" | "ok" | "none" | "error", text }.
  const [pinAddress, setPinAddress] = useState({ status: "loading", text: "" });

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

  // Whenever the pin is somewhere new, find the address it stands for. A moment of
  // waiting first, so that moving the pin around does not ask for every place on the way.
  useEffect(() => {
    if (readOnly || typeof lat !== "number" || typeof lng !== "number") return undefined;
    const key = pinKey(lat, lng);
    if (ADDRESS_AT.has(key)) {
      const known = ADDRESS_AT.get(key);
      setPinAddress(known ? { status: "ok", text: known } : { status: "none", text: "" });
      return undefined;
    }
    setPinAddress({ status: "loading", text: "" });
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const address = await reverseGeocode(lat, lng);
        if (stale) return;
        ADDRESS_AT.set(key, address ?? "");
        setPinAddress(address ? { status: "ok", text: address } : { status: "none", text: "" });
      } catch {
        if (!stale) setPinAddress({ status: "error", text: "" });
      }
    }, 600);
    return () => { stale = true; clearTimeout(timer); };
  }, [lat, lng, readOnly]);

  // Typing in the address: after a pause, the places that match it are offered.
  function type(v) {
    setText(v);
    setActive(-1);
    setNote("");
    clearTimeout(typing.current.timer);
    typing.current.ctrl?.abort();
    if (v.trim().length < 3) { setOptions([]); setOpen(false); return; }
    typing.current.timer = setTimeout(async () => {
      const ctrl = new AbortController();
      typing.current.ctrl = ctrl;
      try {
        const list = await suggest(v.trim(), ctrl.signal);
        setOptions(list);
        setOpen(list.length > 0);
      } catch (e) {
        if (e.name !== "AbortError") { setOptions([]); setOpen(false); }
      }
    }, 450);
  }

  // Choosing a place: its address is the address, the pin goes there, the map follows.
  function choose(hit) {
    clearTimeout(typing.current.timer);
    typing.current.ctrl?.abort();
    setOptions([]);
    setOpen(false);
    setActive(-1);
    setText(hit.address);
    ADDRESS_AT.set(pinKey(round(hit.lat), round(hit.lng)), hit.address);
    latest.current.onChange({ address: hit.address, lat: round(hit.lat), lng: round(hit.lng) });
    map.current?.setView([hit.lat, hit.lng], Math.max(map.current.getZoom(), 16));
  }

  function keys(e) {
    if (e.key === "ArrowDown" && options.length) { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % options.length); }
    else if (e.key === "ArrowUp" && options.length) { e.preventDefault(); setActive((a) => (a <= 0 ? options.length - 1 : a - 1)); }
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Enter") {
      e.preventDefault();
      if (open && active >= 0 && options[active]) choose(options[active]);
      else search();
    }
  }

  async function search() {
    const query = text.trim();
    if (!query || busy) return;
    clearTimeout(typing.current.timer);
    typing.current.ctrl?.abort();
    setOpen(false);
    setBusy(true);
    setNote("");
    try {
      const hit = await geocode(query);
      if (!hit) { setNote(t("Address not found")); return; }
      ADDRESS_AT.set(pinKey(round(hit.lat), round(hit.lng)), hit.address);
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
    if (pinAddress.status === "ok") { latest.current.onChange({ ...latest.current.value, address: pinAddress.text }); return; }
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
    <div className="w-full max-w-[40.6rem]">
      <div className="flex h-[33.8rem] flex-col overflow-hidden rounded-md border border-gray-300 bg-[#fff]">
        <div className="relative z-10 shrink-0 border-b border-gray-300 p-2">
          {readOnly ? (
            <p className="min-h-9 px-1 py-2 text-sm text-gray-900">{value?.address || <span className="text-gray-400">—</span>}</p>
          ) : (
            <div className="relative">
              <input
                value={text}
                onChange={(e) => type(e.target.value)}
                onFocus={() => { if (options.length) setOpen(true); }}
                onBlur={() => {
                  setOpen(false);
                  if (text !== (value?.address ?? "")) latest.current.onChange({ ...(latest.current.value ?? {}), address: text, lat: value?.lat ?? null, lng: value?.lng ?? null });
                }}
                onKeyDown={keys}
                placeholder={t("Staroměstské náměstí 1/3, 110 00, Staré Město, Praha 1")}
                aria-label={t("Address")}
                role="combobox"
                aria-expanded={open}
                aria-autocomplete="list"
                autoComplete="off"
                className="h-9 w-full rounded-md border border-gray-300 bg-[#fff] px-3 text-sm focus:border-violet-400 focus:outline-none"
              />
              {open && (
                <ul role="listbox" className="absolute left-0 right-0 top-full z-[600] mt-1 max-h-60 overflow-y-auto rounded-md border border-gray-300 bg-white py-1 shadow-lg">
                  {options.map((o, i) => (
                    <li key={`${o.name}|${o.address}`} role="option" aria-selected={i === active}>
                      {/* mousedown, so the field keeps focus and the choice is made before it blurs */}
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); choose(o); }}
                        onMouseEnter={() => setActive(i)}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-800 ${i === active ? "bg-gray-100" : ""}`}
                      >
                        <MapPinned size={13} className="shrink-0 text-gray-500" />
                        <span className="min-w-0 truncate">
                          {o.name && <span className="font-medium text-gray-900">{o.name} · </span>}
                          {o.address}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {note && <p className="px-1 pt-1 text-xs text-red-700">{note}</p>}
        </div>

        {/* The coordinates of the pin, with what can be done with the pin, under the address. */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-300 px-3 py-2">
          <p className="min-w-0 truncate text-xs text-gray-900" title={pinned ? [`${value.lat}, ${value.lng}`, pinAddress.text].filter(Boolean).join(" ") : undefined}>
            {pinned ? (
              <>
                <span className="font-mono">{`${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`}</span>
                {!readOnly && (
                  <span className="ml-1.5" data-pin-address>
                    {pinAddress.status === "ok" && `(${pinAddress.text})`}
                    {pinAddress.status === "loading" && <span className="text-gray-500">(…)</span>}
                    {pinAddress.status === "none" && <span className="text-gray-500">({t("No address at the pin")})</span>}
                  </span>
                )}
              </>
            ) : t("No pin yet")}
          </p>
          {!readOnly && pinned && (
            <div className="flex shrink-0 items-center gap-0.5">
              <button type="button" onClick={addressAtPin} disabled={busy || (pinAddress.status === "ok" && pinAddress.text === (value?.address ?? ""))} className={smallButton} title={t("Use the address nearest to the pin")}>
                <MapPinned size={13} /> {t("Use the address at the pin")}
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

        {/* isolate: the map's own layers use high z-indexes that must not rise over the sticky tabs */}
        <div className="relative isolate min-h-0 flex-1">
          <div ref={box} className="absolute inset-0 bg-gray-100" />
          {!readOnly && !pinned && (
            <p className="pointer-events-none absolute inset-x-0 top-3 z-[500] mx-auto w-fit rounded-full bg-[#fff] px-3 py-1 text-xs font-medium text-gray-900 shadow ring-1 ring-gray-300">
              {t("Click the map to place the pin")}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
