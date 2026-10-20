# H.W.P.L — Health, Work, Play, Love tracker

A starter Expo app (iOS + Android from one codebase) with a fully local
SQLite database — no backend required to run it.

## What's included

- **Daily rating popup** — rate Health / Work / Play / Love from 0 to 5 with
  optional note, stored in the local SQLite database.
- **Items + notes workflow** — add outstanding items with an optional deadline
  (`YYYY-MM-DD`), mark them complete, and keep separate archived notes tagged by
  Health, Work, Play, or Love.
- **Reports dashboard** — weekly/monthly averages per category, a month-view
  rating calendar, and an optional "Generate AI summary" button.
  - character collection: start as Basic, unlock and switch to Leafhead after logging ratings on any 3 days, then earn a random character pull for every 7 days rated (characters from the snowhex Pixel Plains asset pack: https://snowhex.itch.io/pixel-plains)
- **Astrology tab** — set up a birth chart, review the current moon / transits,
  and generate a monthly theme based on your chart plus the sky for the month.
- **Personalization + backup** — save your preferred name, theme, and font, then
  export/import automatic local backups for easy restoration.
- **Notifications** — a daily reminder to log your ratings and a Wednesday
  "midweek check-in" push listing how many items are still open (see
  `notifications.js`).

## Running it

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone (fastest way to test on a
real device), or press `i` / `a` in the terminal for iOS/Android
simulators.

> Notifications require a physical device or a properly configured
> simulator — they won't fire in Expo Go on iOS Simulator, only on a
> real iPhone or a dev build.

## AI Summary

The app never calls an LLM API directly from the client — that would
mean shipping your API key inside the app bundle, which anyone could
extract. Instead, update `SUMMARY_ENDPOINT` in `ai/summarize.js` to point at your
deployed URL.

Once that's live, tapping "Generate AI summary" on the Reports tab
sends that period's averages, notes attached to ratings, and active notes
tagged by Health, Work, Play, or Love in the matching category, then gets
back a short reflective summary.
