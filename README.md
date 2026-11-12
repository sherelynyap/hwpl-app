# H.W.P.L — Health, Work, Play, Love tracker

A starter Expo app (iOS + Android from one codebase) with a fully local
SQLite database — no backend required to run it.

This is a personal wellbeing tracker designed for quick check-ins across the
four life domains that give the app its name: Health, Work, Play, and Love.
Everything is stored locally on-device, which keeps the experience fast,
private, and easy to back up or restore without needing a separate server.

## What's included

| Feature | Description |
|---|---|
| **Daily rating popup** | Rate Health / Work / Play / Love from 0 to 5 with optional note, stored in the local SQLite database. This is the core habit loop: log a quick check-in, reflect on the week, and build patterns over time. |
| **Items + notes workflow** | Add outstanding items with an optional deadline (`YYYY-MM-DD`), mark them complete, and keep separate archived notes tagged by Health, Work, Play, or Love. This helps separate tasks from reflections while still keeping all categories in one place. |
| **Reports dashboard** | Weekly/monthly averages per category, a month-view rating calendar, and an optional "Generate AI summary" button. |
| **Character collection** | Start as Basic, unlock and switch to Leafhead after logging ratings on any 3 days, then earn a random character pull for every 7 days rated (characters from the snowhex Pixel Plains asset pack: https://snowhex.itch.io/pixel-plains). |
| **Astrology tab** | Set up a birth chart, review the current moon / transits, and generate a monthly theme based on your chart plus the sky for the month. |
| **Personalization + backup** | Save your preferred name, theme, and font, then export/import automatic local backups for easy restoration. A regular local backup flow makes the app safer to use as a long-term personal journal. |
| **Notifications** | A daily reminder to log your ratings and a Wednesday "midweek check-in" push listing how many items are still open (see `notifications.js`). |

## Running it

```bash
npm install
npx expo start
```

Use Expo Go on a phone for the fastest real-device testing loop, or press `i`
/ `a` in the terminal to open an iOS or Android simulator.

A few practical notes:

| Topic | Note |
|---|---|
| Database | The app uses Expo + local SQLite, so there is no database server to configure. |
| Backups and exports | For backups and exports, use the personalization area in-app rather than a separate service. |
| Notifications | Notifications require a physical device or a properly configured simulator — they won't fire in Expo Go on iOS Simulator, only on a real iPhone or a dev build. |

> If you are running the project on a clean machine, make sure you have the
> standard Expo toolchain installed and available in your terminal before
> starting the app.

## AI Summary

The app never calls an LLM API directly from the client — that would
mean shipping your API key inside the app bundle, which anyone could
extract. Instead, update `SUMMARY_ENDPOINT` in `ai/summarize.js` to point at your
deployed URL.

Once that's live, tapping "Generate AI summary" on the Reports tab
sends that period's averages, notes attached to ratings, and active notes
tagged by Health, Work, Play, or Love in the matching category, then gets
back a short reflective summary.