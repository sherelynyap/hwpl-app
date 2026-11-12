const MONTHLY_THEME_ENDPOINT = 'https://hwpl-backend.vercel.app/api/monthly-theme';

export async function generateMonthlyTheme(natal, transits, monthLabel, placements = null) {
  const response = await fetch(MONTHLY_THEME_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ natal, transits, monthLabel, placements }),
  });
  if (!response.ok) throw new Error(`Monthly theme endpoint returned ${response.status}`);
  const data = await response.json();
  return data.theme;
}