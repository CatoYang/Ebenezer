# Setup

Two parts: **accounts** (once, owned by the organisation rather than a person) and **environments**
(dev first, then prod). Never paste tokens or secrets into chat, commits or issues. They go in the
password manager, `supabase/functions/.env` (dev, git-ignored) or `supabase secrets set`.

## Part 1 — Accounts

The aim is that the app outlives any one person. Every account hangs off one organisation email, every
credential lives in a shared vault, and at least two people can get in.

### 1. Organisation email (everything else hangs off this)
- If the church has its own domain, ask for an address on it, e.g. `prayer-app@<church domain>`.
  Otherwise create a new Gmail account for the app.
- Turn on 2-step verification with an authenticator app. Save the backup codes in the vault (step 2).
- Add a second person's phone or email as a recovery option, e.g. a church admin.

### 2. Password manager with a shared vault
- Bitwarden (free for 2 people, discounts for nonprofits) or 1Password.
- Create a shared collection, e.g. "Ebenezer". Share it with one other trusted person.
- Everything from here goes in it: logins, 2FA backup codes, both bot tokens, webhook and scheduler
  secrets, and the Supabase database passwords.

### 3. Telegram account that owns the bots
A bot belongs to the Telegram account that created it in BotFather, and a Telegram account needs a phone
number. Use a **church-owned number**, not a personal one.
- Get a prepaid SIM for the church and sign up for Telegram with it. A spare phone works, and you can then
  also log in from Telegram Desktop.
- Settings → Privacy and Security → **Two-Step Verification**: set a password and store it in the vault.
- Same screen → "Delete my account if away for": set it to the **longest option**.
- **Keep the SIM topped up.** If a prepaid number expires and is reassigned, the new holder can take over
  the Telegram account, and the bots with it.

### 4. Create the two bots (in that Telegram account)
In a chat with [@BotFather](https://t.me/BotFather):
1. `/newbot` → name "Ebenezer (Dev)", username e.g. `<church>EbenezerDevBot`. Save the token in the vault.
2. `/newbot` → name "Ebenezer", username e.g. `<church>EbenezerBot`. Save the token in the vault.
3. For each bot: `/setdescription`, `/setabouttext` and `/setuserpic`. The command list is set by
   `npm run webhook:set`.

### 5. GitHub organisation
- Sign in to GitHub as the organisation email → create a **free organisation**, e.g. `<church>-tech`.
- Invite your personal GitHub account as a second **Owner**.
- The repo currently lives at https://github.com/CatoYang/Ebenezer. Move it into the organisation
  with Settings → Transfer ownership; GitHub redirects the old URL.

### 6. Supabase organisation and projects
- Sign up at supabase.com with the organisation email (or "Continue with GitHub" as that account).
- Create an **organisation** named after the church. Invite your personal account as **Owner**.
- Create two projects in it, both in **Southeast Asia (Singapore)**:
  - `ebenezer-dev`
  - `ebenezer-prod`
  Save each database password in the vault.
- Both can start on the Free plan. Before real users depend on reminders, upgrade **prod** to Pro
  (US$25/month, church card on the organisation's billing). Free projects pause after 7 days of
  inactivity, which would silently stop reminders.

### 7. Mini App hosting: GitHub Pages
No extra account. One-time: repo **Settings → Pages → Source: "GitHub Actions"**. Every push to `main`
that touches `miniapp/` then rebuilds and publishes it (`.github/workflows/miniapp.yml`) at
`https://catoyang.github.io/Ebenezer/`. When the repo moves to the church organisation, the address
changes: update `MINIAPP_URL` and run the webhook script again.

## Part 2 — Local development

Prerequisites: Docker running (WSL: Docker Desktop with WSL integration, or Docker Engine in WSL),
Node 20+.

```bash
npm install                                   # installs the Supabase CLI and Deno locally
cp supabase/functions/.env.example supabase/functions/.env
# edit supabase/functions/.env: BOT_TOKEN = the DEV bot token; secrets = `openssl rand -hex 32` each
npm run db:start                              # local Postgres + API in Docker; applies migrations
npm run bot:dev                               # runs the bot with polling; message your dev bot
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests (Deno) + database tests (pgTAP) |
| `npm run check` | Type-check, lint, format check |
| `npm run dev:due` | Make all pending follow-ups due now, so `bot:dev` sends them within a minute |
| `npx supabase migration up --local` | Apply new migrations without wiping local data |
| `npm run db:reset` | Rebuild the local DB from migrations (wipes local data) |
| `npm run functions:serve` | Run the Edge Functions locally (for testing `scheduler-tick` with curl) |
| `npm run db:stop` | Stop the local Docker stack |

**Only one copy of a bot can receive messages.** `npm run bot:dev` deletes the dev bot's webhook, so the
cloud copy goes quiet while you test locally. Afterwards, run `npm run cloud:dev:webhook` to hand the bot
back to the cloud. If the webhook is set while `bot:dev` is running, `bot:dev` stops with a 409 error.

### Mini App

```bash
npm run miniapp:tunnel     # Vite dev server + Cloudflare tunnel; points the DEV bot's Open button at it
```

Open the dev bot in Telegram and tap **Open**: you're running your local Mini App code, with live reload,
against the **cloud dev api** (the same data as the deployed bot). Ctrl+C points the Open button back at
the published app. A new tunnel can take up to a minute to start answering.

`npm run miniapp:build` builds it locally; `npm run check` type-checks it with the functions.

## Part 3 — Deploy an environment

### Cloud dev (set up 2026-11-03)

The dev project's ref, database password and a CLI access token for its Supabase account live in
`.env.dev` at the repo root (git-ignored):

```
SUPABASE_PROJECT_REF=…
SUPABASE_DB_PASSWORD=…
SUPABASE_ACCESS_TOKEN=sbp_…   # Account → Access Tokens; keeps this repo off your personal CLI login
```

| Command | What it does |
| --- | --- |
| `npm run cloud:dev:deploy` | Link, push new migrations, deploy both functions |
| `npm run cloud:dev:secrets` | Copy `supabase/functions/.env` (bot token, secrets, `MINIAPP_URL`) to the cloud functions |
| `npm run cloud:dev:due` | Make your pending dev follow-ups due now; the cloud scheduler sends them within 5 minutes |
| `npm run cloud:dev:webhook` | Point the dev bot at the cloud function, set its commands and Open button (also after `bot:dev`) |

### First-time setup of an environment

Do this once per environment (it's already done for dev). Repeat for prod with the prod bot and project.

```bash
npx supabase login                            # opens a browser; log in as an organisation member
npx supabase link --project-ref <PROJECT_REF> # the ref is in the project URL: <ref>.supabase.co
npx supabase db push                          # applies migrations
npx supabase secrets set BOT_TOKEN=… WEBHOOK_SECRET=… SCHEDULER_SECRET=…
npm run deploy                                # deploys telegram-bot and scheduler-tick
BOT_TOKEN=… WEBHOOK_SECRET=… PROJECT_REF=… npm run webhook:set
```

Then, in the project's SQL editor, store the scheduler's address and secret in Vault. The cron job in
the migration reads them and does nothing until they exist.

```sql
select vault.create_secret('https://<PROJECT_REF>.supabase.co/functions/v1/scheduler-tick', 'scheduler_url');
select vault.create_secret('<the same SCHEDULER_SECRET as above>', 'scheduler_secret');
```

To check it's working, send `/start` to the bot. Then look at the `notifications` table after your
reminder time, or at Edge Functions → scheduler-tick → Logs.
