<p align="center">
  <img src="assets/logo.png" width="160" alt="Ebenezer logo: a cairn of stones crowned with a gold cross at dawn">
</p>

# Ebenezer

> Then Samuel took a stone and set it up between Mizpah and Shen and called its name Ebenezer; for he
> said, "Till now the LORD has helped us." — 1 Samuel 7:12 (ESV)

Ebenezer is a Telegram bot and Mini App for personal prayer. You tell it who or what you're praying
for, and it checks back in with you later ("How is Sarah doing?"). It reminds you to pray at a time you
choose, and keeps answered prayers as your "stones of remembrance".

It's built for a Catholic congregation in Singapore and runs entirely inside Telegram: no app to install
and no account to create.

**Try it:** [t.me/EbenezerStonesBot](https://t.me/EbenezerStonesBot) · **How to use it:**
[User guide](docs/USER_GUIDE.md)

## What it does

| | |
| --- | --- |
| **Mini App** | The main way in, inside Telegram: add and manage intentions, look back on *Answered* prayers (your stones of remembrance), see your *Journey* (streaks and a calendar), change *Settings*. |
| **Intentions** | In the app, or `/pray Sarah – surgery on Friday`: saves an intention and asks when to check in (3 days to 1 month). |
| **Follow-ups** | On the check-in day: *Answered* (with a note), *Still praying*, *Ask me tomorrow* or *Stop following up*. |
| **Daily reminder** | "Have you had a moment to pray today?" at your chosen time; skipped on days you've already prayed. |
| **Weekly summary** | Mondays: days prayed, streak, prayers answered. |
| **Privacy** | Each person sees only their own data. Nothing is shared with anyone. `/deletemydata` removes everything. |

## How it works

```
 Telegram (phone / desktop)                 Supabase (Singapore)                  GitHub Pages
 ┌──────────────────────┐   webhook   ┌──────────────────────────────┐
 │ Bot chat             │ ──────────▶ │ telegram-bot  (Edge Function)│
 │                      │ ◀────────── │ scheduler-tick ◀── Cron 5 min│
 │ Mini App (web view) ─┼── api ────▶ │ api           (Edge Function)│      ┌──────────────┐
 │   loaded from ───────┼─────────────┼──────────────────────────────┼────▶ │ miniapp/ build│
 └──────────────────────┘             │ Postgres: all data           │      └──────────────┘
                                      └──────────────────────────────┘
```

- **Telegram** carries messages and vouches for who each person is. It stores none of the app's data.
- **Supabase** runs all the code (three Edge Functions) and holds all the data (Postgres), keyed by
  each person's Telegram user ID. That's why the same account works the same on every device.
- **GitHub Pages** hosts the Mini App's static files. They contain no data and no secrets; the app
  fetches each person's data from the `api` function, which checks Telegram's signature every time.

Everything is TypeScript: [grammY](https://grammy.dev) for the bot, Deno on Supabase Edge Functions,
React 18 with [Telegram's UI kit](https://github.com/Telegram-Mini-Apps/TelegramUI) for the Mini App.

## Documentation

| Document | For |
| --- | --- |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | People using Ebenezer: getting started, every button explained |
| [docs/MAINTENANCE.md](docs/MAINTENANCE.md) | Whoever looks after it: changes, health checks, troubleshooting, secrets, data requests |
| [docs/SETUP.md](docs/SETUP.md) | First-time setup: accounts, local development, deploying an environment |
| [docs/PLAN.md](docs/PLAN.md) | Roadmap, decisions and what's done |
| [AGENTS.md](AGENTS.md) | Code conventions and rules (also read by AI coding agents) |

## Development quick start

Needs Node 20+ and Docker. The Supabase CLI and Deno come with `npm install`.

```bash
npm install
cp supabase/functions/.env.example supabase/functions/.env   # add a test bot's token
npm run db:start      # local database in Docker
npm run bot:dev       # run the bot on your machine (polling) with the scheduler every minute
npm test              # unit + database tests
npm run check         # type-check, lint, format
```

See [SETUP.md](docs/SETUP.md) for the full guide and [MAINTENANCE.md](docs/MAINTENANCE.md) for deploying.

## Repository layout

```
supabase/
  migrations/          database schema and SQL functions (one file per change)
  functions/           telegram-bot, scheduler-tick, api (+ _shared code)
  tests/database/      pgTAP tests
miniapp/               the Mini App (React + Vite)
scripts/               local dev bot, tunnel, webhook and test helpers
docs/                  user guide, maintenance, setup, plan
assets/                logo (logo.svg is the editable source; logo.png is 640×640 for Telegram)
.github/workflows/     publishes the Mini App to GitHub Pages
```

## Status

Phases 1 (bot) and 2 (Mini App) are built and running on a development project, with friendly testing
next. Before real users: move to church-owned accounts and a production project. See [PLAN.md](docs/PLAN.md).
