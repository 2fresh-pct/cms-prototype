// Finding an address on the map and the address at a point, with OpenStreetMap's
// Nominatim service (free, no key); suggestions while typing come from Photon. Both are
// for light use: the suggestions wait for a pause in the typing and ask for at most
// five places. A production CMS would use the map provider the project chooses
// (Mapy.cz, Mapbox, Google...), whose terms allow suggestions as you type.
const BASE = "https://nominatim.openstreetmap.org";

// "Staroměstské náměstí 1/3, 110 00, Staré Město, Praha 1" from Nominatim's address
// parts: street and number, postal code, quarter and city (district); falls back to
// `fallback` (its long display name) when there is nothing to build from.
function formatAddress(parts, name, fallback) {
  const street = [parts.road ?? parts.pedestrian ?? parts.square ?? name, parts.house_number].filter(Boolean).join(" ");
  const place = parts.city ?? parts.town ?? parts.village ?? parts.municipality;
  const district = (parts.city_district ?? place)?.replace(/^obvod\s+/i, ""); // "obvod Praha 1" -> "Praha 1"
  const quarter = parts.suburb ?? parts.quarter ?? parts.neighbourhood;
  const segments = [street, parts.postcode, quarter && quarter !== district && quarter !== place ? quarter : "", district];
  return [...new Set(segments.filter(Boolean))].join(", ") || fallback;
}

// Up to five places that match what is being typed: [{ name, address, lat, lng }].
// Nominatim cannot complete a half-typed word ("Staroměst"), so the matching is done
// by Photon (OpenStreetMap data, made for search as you type); the Czech address of
// each place, in the format above, is then asked of Nominatim in one request.
const PHOTON = "https://photon.komoot.io/api/";
const PRAGUE = { lat: 50.0755, lng: 14.4378 };

export async function suggest(query, signal) {
  const res = await fetch(`${PHOTON}?limit=8&lat=${PRAGUE.lat}&lon=${PRAGUE.lng}&q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const features = ((await res.json()).features ?? []).filter((f) => f.properties?.countrycode === "CZ").slice(0, 5);
  if (features.length === 0) return [];

  const idOf = (f) => `${f.properties.osm_type}${f.properties.osm_id}`;
  const ids = features.map(idOf).join(",");
  const lookup = await fetch(`${BASE}/lookup?format=jsonv2&addressdetails=1&accept-language=cs&osm_ids=${ids}`, { signal });
  const found = lookup.ok ? await lookup.json() : [];
  const byId = new Map(found.map((h) => [`${String(h.osm_type)[0].toUpperCase()}${h.osm_id}`, h]));

  const seen = new Set();
  return features
    .map((f) => {
      const [lng, lat] = f.geometry.coordinates;
      const p = f.properties;
      const hit = byId.get(idOf(f));
      const address = hit
        ? formatAddress(hit.address ?? {}, hit.name, hit.display_name)
        : [[p.street, p.housenumber].filter(Boolean).join(" "), p.postcode, p.district, p.city].filter(Boolean).join(", ");
      const name = hit?.name ?? p.name ?? "";
      return { name: name && !address.startsWith(name) ? name : "", address, lat, lng };
    })
    .filter((x) => x.address && (seen.has(`${x.name}|${x.address}`) ? false : seen.add(`${x.name}|${x.address}`)));
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
