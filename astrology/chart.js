import * as Astronomy from 'astronomy-engine';
import { sunSignForDate, signForLongitude, wholeSignHouse } from './zodiac';

const NATAL_BODIES = [
  ['sun', Astronomy.Body.Sun],
  ['moon', Astronomy.Body.Moon],
  ['mercury', Astronomy.Body.Mercury],
  ['venus', Astronomy.Body.Venus],
  ['mars', Astronomy.Body.Mars],
  ['jupiter', Astronomy.Body.Jupiter],
  ['saturn', Astronomy.Body.Saturn],
];
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const OBLIQUITY_DEG = 23.4367; // mean obliquity — fine for a casual feature, not exact

function eclipticLongitudeOf(body, date) {
  const vec = Astronomy.GeoVector(body, date, true);
  return Astronomy.Ecliptic(vec).elon;
}

export function computeNatalChart({ birthDate, birthTime, latitude, longitude }) {
  const sunSign = sunSignForDate(birthDate);
  let moonSign = null;
  let ascendantSign = null;
  let placements = null;

  if (birthTime) {
    const dt = combineDateAndTime(birthDate, birthTime);
    moonSign = signForLongitude(eclipticLongitudeOf(Astronomy.Body.Moon, dt));
    if (latitude != null && longitude != null) {
      ascendantSign = signForLongitude(computeAscendantLongitude(dt, latitude, longitude));
    }
    placements = NATAL_BODIES.map(([key, body]) => {
      const sign = signForLongitude(eclipticLongitudeOf(body, dt));
      return { body: key, sign, house: wholeSignHouse(sign, ascendantSign) };
    });
  }
  return { sunSign, moonSign, ascendantSign, placements };
}

export function computeCurrentTransits(date = new Date()) {
  const result = {};
  for (const [key, body] of NATAL_BODIES) {
    result[`${key}Sign`] = signForLongitude(eclipticLongitudeOf(body, date));
  }
  return result;
}
const MOON_PHASE_NAMES = [
  [15, 'New Moon'], [90, 'Waxing Crescent'], [105, 'First Quarter'],
  [180, 'Waxing Gibbous'], [195, 'Full Moon'], [270, 'Waning Gibbous'],
  [285, 'Last Quarter'], [345, 'Waning Crescent'],
];

export function computeMoonPhase(date = new Date()) {
  const phaseAngle = Astronomy.MoonPhase(date); // 0-360, 0=new, 180=full
  const phaseName = MOON_PHASE_NAMES.find(([max]) => phaseAngle < max)?.[1] || 'New Moon';
  const illumination = (1 - Math.cos((phaseAngle * Math.PI) / 180)) / 2; // 0..1
  return { phaseAngle, phaseName, illumination };
}

export function nextMoonQuarters(date = new Date()) {
  let newMoon = null;
  let fullMoon = null;
  let q = Astronomy.SearchMoonQuarter(date);
  for (let i = 0; i < 4 && (!newMoon || !fullMoon); i++) {
    if (q.quarter === 0 && !newMoon) newMoon = q.time.date;
    if (q.quarter === 2 && !fullMoon) fullMoon = q.time.date;
    q = Astronomy.NextMoonQuarter(q);
  }
  return { nextNewMoon: newMoon, nextFullMoon: fullMoon };
}

// Retrograde = apparent backward motion from Earth's viewpoint. Detected
// here by comparing ecliptic longitude one day apart — if it decreased,
// the planet is retrograde. (The Moon and Sun never retrograde, so
// they're excluded.)
const RETROGRADE_CAPABLE_BODIES = [
  ['mercury', Astronomy.Body.Mercury],
  ['venus', Astronomy.Body.Venus],
  ['mars', Astronomy.Body.Mars],
  ['jupiter', Astronomy.Body.Jupiter],
  ['saturn', Astronomy.Body.Saturn],
];

export function computeRetrogrades(date = new Date()) {
  const halfIntervalMs = 60 * 60 * 1000;
  const earlier = new Date(date.getTime() - halfIntervalMs);
  const later = new Date(date.getTime() + halfIntervalMs);
  return RETROGRADE_CAPABLE_BODIES.map(([key, body]) => {
    const lon1 = eclipticLongitudeOf(body, earlier);
    const lon2 = eclipticLongitudeOf(body, later);
    let delta = lon2 - lon1;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return { body: key, retrograde: delta < 0 };
  });
}

function combineDateAndTime(datePart, timePart, utcOffsetHours = 8) {
  // Use the calendar date as entered, avoiding any device-timezone parsing
  const [y, mo, d] = typeof datePart === 'string'
    ? datePart.slice(0, 10).split('-').map(Number)
    : [datePart.getFullYear(), datePart.getMonth() + 1, datePart.getDate()];
  const [h, m] = timePart.split(':').map(Number);

  // Local birth time minus the birthplace's offset = the true UTC instant
  return new Date(Date.UTC(y, mo - 1, d, h, m) - utcOffsetHours * 3600 * 1000);
}

// Standard Ascendant formula from local sidereal time + latitude + obliquity.
// Approximate — good enough for a casual monthly-themes feature.
function computeAscendantLongitude(date, latitudeDeg, longitudeDeg) {
  const gstHours = Astronomy.SiderealTime(date);
  const lstHours = ((gstHours + longitudeDeg / 15) % 24 + 24) % 24;
  const ramc = lstHours * 15 * DEG2RAD;
  const lat = latitudeDeg * DEG2RAD;
  const obl = OBLIQUITY_DEG * DEG2RAD;

  const y = Math.cos(ramc);
  const x = -(Math.sin(ramc) * Math.cos(obl) + Math.tan(lat) * Math.sin(obl));
  return ((Math.atan2(y, x) * RAD2DEG) % 360 + 360) % 360;
}