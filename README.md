# H.W.P.L — Health, Work, Play, Love tracker

A starter Expo app (iOS + Android from one codebase) with a fully local
SQLite database — no backend required to run it.

## What's included

- **Daily rating popup** — rate Health / Work / Play / Love from 0 to 5 with
  optional note, stored in local SQLite.
- **Items tab** — add outstanding items with an optional deadline
  (`YYYY-MM-DD`), tap to mark done, and manage notes in a separate section.
- **Reports tab** — weekly/monthly average per category with a simple
  bar chart, plus an optional "Generate AI summary" button.
- **Notifications** — a daily reminder to log your ratings, and a
  Wednesday "midweek check-in" push listing how many items are still
  open (see `notifications.js`).

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

## Wiring up the AI summary (optional)

The app never calls an LLM API directly from the client — that would
mean shipping your API key inside the app bundle, which anyone could
extract. Instead update `SUMMARY_ENDPOINT` in `ai/summarize.js` to point at your
deployed URL.

Once that's live, tapping "Generate AI summary" on the Reports tab
sends that period's averages + any notes you attached to ratings, and
gets back a short reflective summary.

## Where to take it next

- **Charts**: swap the simple bar in `ReportsScreen.js` for a proper
  trend line (e.g. `react-native-svg` or `victory-native`) once you
  have a few weeks of data.
- **Natural-language quick add**: parse free text like "dentist next
  Tuesday" into a structured item + deadline via the same AI endpoint
  pattern used for summaries.
- **Sync across devices**: swap local SQLite for Supabase Postgres
  (same query shapes) if you want your data to follow you across
  phones, or to back it up.
- **Correlation detection**: reuse your statistical-analysis approach
  from the TOTO project to look for patterns like "Play dips in weeks
  with 3+ overdue Work items."
