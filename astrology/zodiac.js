export const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const SIGN_START_DATES = [
  { sign: 'Capricorn', month: 1, day: 1 },
  { sign: 'Aquarius', month: 1, day: 20 },
  { sign: 'Pisces', month: 2, day: 19 },
  { sign: 'Aries', month: 3, day: 21 },
  { sign: 'Taurus', month: 4, day: 20 },
  { sign: 'Gemini', month: 5, day: 21 },
  { sign: 'Cancer', month: 6, day: 21 },
  { sign: 'Leo', month: 7, day: 23 },
  { sign: 'Virgo', month: 8, day: 23 },
  { sign: 'Libra', month: 9, day: 23 },
  { sign: 'Scorpio', month: 10, day: 23 },
  { sign: 'Sagittarius', month: 11, day: 22 },
  { sign: 'Capricorn', month: 12, day: 22 },
];

export function sunSignForDate(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  for (let i = SIGN_START_DATES.length - 1; i >= 0; i--) {
    const s = SIGN_START_DATES[i];
    if (month > s.month || (month === s.month && day >= s.day)) return s.sign;
  }
  return 'Capricorn';
}

export function signForLongitude(longitudeDeg) {
  const normalized = ((longitudeDeg % 360) + 360) % 360;
  return ZODIAC_SIGNS[Math.floor(normalized / 30)];
}

// Whole Sign houses: House 1 = the Ascendant's sign, House 2 = the next
// sign, and so on around the zodiac — the simplest and oldest house
// system, needing nothing beyond the Ascendant sign itself.
export function wholeSignHouse(sign, ascendantSign) {
  if (!ascendantSign) return null;
  const signIndex = ZODIAC_SIGNS.indexOf(sign);
  const ascIndex = ZODIAC_SIGNS.indexOf(ascendantSign);
  if (signIndex === -1 || ascIndex === -1) return null;
  return ((signIndex - ascIndex + 12) % 12) + 1;
}