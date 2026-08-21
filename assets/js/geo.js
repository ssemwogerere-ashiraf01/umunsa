// =========================================================================
// Location detection helpers, shared by:
//   - assets/js/phone-input.js  (auto-picks the phone country code)
//   - elections/index.html      (advisory "are you near campus?" check
//                                 before a vote is cast)
//
// IP lookups use GeoJS (https://www.geojs.io) — free, no API key, CORS
// enabled from the browser. Nothing here is a hard security guarantee:
// IP geolocation is approximate and GPS position is self-reported by the
// browser, so a determined user can spoof either. Treat both as UX nudges,
// not proof.
// =========================================================================

const IP_GEO_URL = 'https://get.geojs.io/v1/ip/geo.json';
const IP_GEO_CACHE_KEY = 'nsa-ip-geo-cache-v1';
const IP_GEO_TIMEOUT_MS = 3000;

/**
 * Uganda Martyrs University, Nkozi main campus (approximate centre —
 * https://en.wikipedia.org/wiki/Uganda_Martyrs_University). Adjust if you
 * have a more precise campus boundary, and tune the radius per call site.
 */
export const CAMPUS_COORDS = { lat: 0.0036, lng: 32.0144 };
export const DEFAULT_CAMPUS_RADIUS_KM = 3;

let ipGeoPromise = null;

/**
 * Best-effort IP geolocation of the visitor (country/city/lat/lng).
 * Never throws — resolves to null on any failure or timeout. Cached for
 * the tab session (sessionStorage) so it only runs once per visit.
 */
export function getIpGeolocation() {
  if (ipGeoPromise) return ipGeoPromise;

  try {
    const cached = sessionStorage.getItem(IP_GEO_CACHE_KEY);
    if (cached) {
      ipGeoPromise = Promise.resolve(JSON.parse(cached));
      return ipGeoPromise;
    }
  } catch { /* sessionStorage unavailable — fall through to a fresh lookup */ }

  ipGeoPromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), IP_GEO_TIMEOUT_MS);
      const res = await fetch(IP_GEO_URL, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = await res.json();
      const result = {
        countryCode: (data.country_code || '').toUpperCase() || null,
        country: data.country || null,
        city: data.city || null,
        lat: data.latitude != null ? Number(data.latitude) : null,
        lng: data.longitude != null ? Number(data.longitude) : null,
      };
      try { sessionStorage.setItem(IP_GEO_CACHE_KEY, JSON.stringify(result)); } catch { /* ignore */ }
      return result;
    } catch {
      return null;
    }
  })();

  return ipGeoPromise;
}

/** Great-circle distance in kilometres between two lat/lng points (haversine). */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Promise wrapper around navigator.geolocation.getCurrentPosition. */
export function getBrowserPosition({ timeout = 8000, enableHighAccuracy = true } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('unsupported')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(err),
      { timeout, enableHighAccuracy, maximumAge: 60000 },
    );
  });
}

/**
 * Checks whether the visitor's device is within radiusKm of CAMPUS_COORDS,
 * using the browser's GPS. Advisory only — see the module note above.
 *
 * @returns {Promise<{status: 'in-range'|'out-of-range'|'denied'|'unsupported'|'error', distanceKm: number|null, message: string}>}
 */
export async function checkCampusProximity(radiusKm = DEFAULT_CAMPUS_RADIUS_KM) {
  try {
    const pos = await getBrowserPosition();
    const distanceKm = haversineKm(pos.lat, pos.lng, CAMPUS_COORDS.lat, CAMPUS_COORDS.lng);
    return {
      status: distanceKm <= radiusKm ? 'in-range' : 'out-of-range',
      distanceKm,
      message: distanceKm <= radiusKm
        ? 'Location confirmed near campus.'
        : `You appear to be about ${distanceKm.toFixed(1)} km from campus.`,
    };
  } catch (err) {
    if (err && err.code === 1) {
      return { status: 'denied', distanceKm: null, message: 'Location permission was not granted.' };
    }
    if (err && err.message === 'unsupported') {
      return { status: 'unsupported', distanceKm: null, message: 'This device does not support location detection.' };
    }
    return { status: 'error', distanceKm: null, message: 'Could not determine your location.' };
  }
}