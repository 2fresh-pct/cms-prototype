// Finding an address on the map and the address at a point, with OpenStreetMap's
// Nominatim service (free, no key). It is for light use, one request when someone
// asks for it (Enter, or the search button), never while typing. A production CMS
// would use the map provider the project chooses (Mapy.cz, Mapbox, Google...).
const BASE = "https://nominatim.openstreetmap.org";

// "Staroměstské náměstí 1, 110 00 Praha" from Nominatim's address parts; falls
// back to `fallback` (its long display name) when there is nothing to build from.
function formatAddress(parts, name, fallback) {
  const street = [parts.road ?? parts.pedestrian ?? parts.square ?? name, parts.house_number].filter(Boolean).join(" ");
  const city = [parts.postcode, parts.city ?? parts.town ?? parts.village ?? parts.municipality].filter(Boolean).join(" ");
  return [street, city].filter(Boolean).join(", ") || fallback;
}

// { address, lat, lng } of the best match for `query`, or null when none.
export async function geocode(query) {
  const url = `${BASE}/search?format=jsonv2&addressdetails=1&limit=1&accept-language=cs&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const [hit] = await res.json();
  if (!hit) return null;
  return { lat: Number(hit.lat), lng: Number(hit.lon), address: formatAddress(hit.address ?? {}, hit.name, hit.display_name) };
}

// The address nearest to a point, or null when there is none.
export async function reverseGeocode(lat, lng) {
  const url = `${BASE}/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=cs&lat=${lat}&lon=${lng}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const hit = await res.json();
  return hit && !hit.error ? formatAddress(hit.address ?? {}, hit.name, hit.display_name) : null;
}
