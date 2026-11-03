# Maintaining Ebenezer

How to change, check, fix and look after Ebenezer once it's running. For first-time setup see
[SETUP.md](SETUP.md); for what's planned see [PLAN.md](PLAN.md).

Today there is one cloud environment, **dev** (Supabase project `eruqnzwvcknwyqxgnnnz`, Singapore). The
real bot, **@EbenezerStonesBot**, runs against it until a production project exists (see
[Going to production](#going-to-production)). The `cloud:dev:*` commands below all target dev.

## What runs where

| Piece | Where | How it's updated |
| --- | --- | --- |
| Bot (`telegram-bot`), reminders (`scheduler-tick`), Mini App API (`api`) | Supabase Edge Functions | `npm run cloud:dev:deploy` |
| Database: tables and SQL functions | Supabase Postgres | New file in `supabase/migrations/`, then `npm run cloud:dev:deploy` |
| 5-minute timer | Supabase Cron (`scheduler-tick` job), URL + secret in Supabase Vault | Set once per environment (SETUP.md) |
| Mini App (static files) | GitHub Pages, `catoyang.github.io/Ebenezer/` | Push to `main`; GitHub Actions publishes it |
| Bot name, picture, description | Telegram, via @BotFather | `/setname`, `/setuserpic`, `/setdescription` |
| Bot commands, webhook, Open button | Telegram | `npm run cloud:dev:webhook` |

### Where secrets live

| Secret | Kept in | Also in |
| --- | --- | --- |
| Bot token, webhook secret, scheduler secret, `MINIAPP_URL` | `supabase/functions/.env` (git-ignored) | Supabase function secrets (`npm run cloud:dev:secrets`) |
| Scheduler URL + secret for Cron | Supabase Vault (`scheduler_url`, `scheduler_secret`) | |
| Project ref, database password, CLI access token | `.env.dev` (git-ignored) | |
| All of the above + account logins | The shared password manager | |

Never commit any of them. `git grep` before pushing if in doubt.

## Making changes

Always run `npm run check` and `npm test` first (local Docker stack: `npm run db:start`).

| Change | Steps |
| --- | --- |
| **Bot wording** | Edit `supabase/functions/_shared/messages.ts` → `npm run cloud:dev:deploy` |
| **Mini App wording or screens** | Edit `miniapp/src/` → try it with `npm run miniapp:tunnel` → push to `main` (publishes in ~1 min) |
| **Bot / scheduler / api behaviour** | Edit `supabase/functions/` → test locally (`npm run bot:dev`) → `npm run cloud:dev:deploy` |
| **Database** | **New** migration: `npx supabase migration new <name>`. Never edit one that's already applied. End it by revoking `execute` from `public, anon, authenticated` (see AGENTS.md). Test with `npx supabase migration up --local` and `npm run test:db`, then `npm run cloud:dev:deploy`. |
| **Bot commands list** | `COMMANDS` in `supabase/functions/_shared/commands.ts`, and the guide in `messages.ts` (a test checks they match) → deploy → `npm run cloud:dev:webhook` |
| **App name** | `APP_NAME` in `messages.ts`; the Mini App's `<title>` (`miniapp/index.html`) and the "opens from its bot" message in `miniapp/src/App.tsx`; BotFather `/setname` |
| **Scripture verse** | `SCRIPTURE` in `messages.ts` and `VERSE` in `miniapp/src/text.ts`. Use wording confirmed against the parish's Bible. |
| **Data protection contact** | `DATA_CONTACT` in `messages.ts` (also in USER_GUIDE.md) |

After deploying, send `/start` (or any command) to the bot and open the app to check.

## Health checks

**Quick check from the terminal:**

```bash
npm run cloud:dev:webhook   # prints the webhook, pending updates and Telegram's last delivery error
```

`Pending updates` should be 0 and there should be no `Last error`. (It also re-applies the commands and
Open button, which is harmless.)

**In the Supabase dashboard** (project → SQL editor), paste any of these:

```sql
-- Is the 5-minute timer running? (expect a run every 5 minutes, status succeeded)
select start_time at time zone 'Asia/Singapore' as sgt, status, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'scheduler-tick')
order by start_time desc limit 10;

-- What did the scheduler send? (expect HTTP 200 and counts of sent/failed)
select created at time zone 'Asia/Singapore' as sgt, status_code, content
from net._http_response order by created desc limit 10;

-- Usage at a glance
select
  (select count(*) from users where privacy_accepted_at is not null) as users,
  (select count(*) from users where blocked_at is not null)          as blocked,
  (select count(*) from prayer_requests where status = 'active')     as active_requests,
  (select count(*) from prayer_requests where status = 'answered')   as answered,
  (select count(*) from prayer_logs where prayed_at > now() - interval '7 days') as prayers_last_7_days;
```

**How far back the timer's history goes:** a daily job (`prune-cron-history`) keeps 7 days of successful
runs and 90 days of failed ones, so the first check above only shows the last week of normal runs. To see
recent problems, add `and status <> 'succeeded'` to it.

**Logs:** dashboard → Edge Functions → pick a function → Logs. They contain errors only, never message
text or prayer content (by design: see AGENTS.md).

**Mini App publishing:** GitHub → Actions → "Mini App → GitHub Pages". A red run means the last change
didn't publish; the previous version stays live.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Bot doesn't reply at all | Webhook removed (e.g. someone ran `npm run bot:dev`, which deletes it) | `npm run cloud:dev:webhook` |
| | Supabase **free project paused** after a week of inactivity | Dashboard → project → Restore. Prevent it with Pro (production). |
| | Bot token changed but cloud not updated | Update `supabase/functions/.env` → `npm run cloud:dev:secrets` → `npm run cloud:dev:webhook` |
| | Function error | Edge Functions → `telegram-bot` → Logs; `Last error` from `cloud:dev:webhook` |
| Daily reminder didn't come | The user already recorded a prayer that day (by design) | None needed |
| | Reminder off, or no reminder time set | `/settings` |
| | User blocked the bot (`users.blocked_at` set) | Cleared automatically when they message the bot again |
| | Timer not running | First SQL check above. If there are no runs: check the `scheduler-tick` cron job and the Vault secrets (SETUP.md). |
| Follow-up didn't come | The previous check-in is still waiting for an answer (no new one until it's answered) | Answer the old message, or manage the request in the app |
| | Request answered, stopped, or set to "Don't check in" | None needed |
| Mini App says "Something went wrong" | `api` error, or the bot token in the cloud doesn't match the bot (sign-in check fails) | Edge Functions → `api` → Logs; make sure the cloud secrets match `.env` |
| Mini App says "Welcome… tap Start first" | That person hasn't agreed to the privacy note in the bot | Open the bot and tap Start |
| Mini App shows an old version | Telegram cached it, or the publish failed | Close the app fully and reopen; check GitHub Actions |
| Mini App tab bar sits under the iPhone home indicator | Known open bug | See PLAN.md |
| `cloud:dev:*` command fails with an auth error | `SUPABASE_ACCESS_TOKEN` in `.env.dev` expired or revoked | Generate a new one (Supabase → Account → Access Tokens) |

To test reminders without waiting: add a request with a check-in, then `npm run cloud:dev:due`; it arrives
within 5 minutes.

## Rotating secrets

Do this if a secret might have leaked (pasted somewhere public, a laptop lost, someone leaving).

| Secret | Steps |
| --- | --- |
| **Bot token** | @BotFather → `/mybots` → bot → API Token → Revoke. Put the new one in `supabase/functions/.env` → `npm run cloud:dev:secrets` → `npm run cloud:dev:webhook`. |
| **Webhook secret** | New value (`openssl rand -hex 32`) in `.env` → `npm run cloud:dev:secrets` → `npm run cloud:dev:webhook`. |
| **Scheduler secret** | New value in `.env` → `npm run cloud:dev:secrets`, then update Vault in the SQL editor: `select vault.update_secret((select id from vault.secrets where name = 'scheduler_secret'), '<new value>');` |
| **Database password** | Dashboard → Project Settings → Database → Reset password → update `.env.dev`. |
| **CLI access token** | Supabase → Account → Access Tokens: create a new one, delete the old, update `.env.dev`. |

The CLI access token and database password for dev were pasted into a chat during setup: rotate both
when convenient.

## Backups

The free plan has **no automatic backups**. Take one regularly (weekly while testing) and before any risky
change:

```bash
npm run cloud:dev:backup    # writes backups/ebenezer-dev-<date>-data.sql (data only; schema = migrations)
```

The file contains prayer content: it's git-ignored and only readable by you. Move it somewhere encrypted
(e.g. the password manager's file storage) and delete old copies. To restore into a fresh project: apply
the migrations (`supabase db push`), then load the file with `psql "<connection string>" -f <file>`.

On the Pro plan (production), Supabase keeps 7 days of daily backups automatically.

## Data and privacy requests

Prayer content is sensitive personal data under Singapore's PDPA. Keep access to the Supabase project
and the password manager to the people who need it.

- **Someone wants their data deleted:** they can send `/deletemydata` themselves. To do it for them, in the
  SQL editor: `delete from users where telegram_user_id = <their id>;` (everything else cascades).
- **Someone asks what's stored about them:** in the SQL editor, look up their `users` row by
  `telegram_user_id` and export their `prayer_requests` and `prayer_logs`. Send it to them only through
  a channel you've confirmed is theirs.
- **Never** read through people's prayers out of curiosity, paste them into chats or tickets, or add
  logging that records them.

## Updating dependencies

| What | Where | Notes |
| --- | --- | --- |
| grammY, supabase-js | `supabase/functions/deno.json` | Run all tests, then deploy to dev and try the bot before anything else. |
| Mini App packages | `miniapp/package.json` | Stay on **React 18** until `@telegram-apps/telegram-ui` supports 19. |
| Supabase CLI, Deno | root `package.json` | The CLI prints when a new version exists. A new *major* version (e.g. 3.x) can change commands: read its notes first. |
| GitHub Actions | `.github/workflows/miniapp.yml` | Bump major versions occasionally. |

## Going to production

Not done yet. The order, when the church accounts exist (details in SETUP.md):

1. Check `DATA_CONTACT` (the parish's data protection contact) is still current.
2. Church Supabase organisation → project `ebenezer-prod` in Singapore, on the **Pro** plan.
3. Add `cloud:prod:*` scripts (copies of `cloud:dev:*` reading `.env.prod`), then push migrations, set
   secrets and deploy functions to prod. Set the Vault secrets for the cron job.
4. Build the Mini App against prod: set `VITE_API_URL` in `.github/workflows/miniapp.yml` to the prod `api`
   URL. Dev testing then uses `npm run miniapp:tunnel`, or a second Pages build.
5. Point **@EbenezerStonesBot** at prod (its secrets plus `cloud:prod:webhook`). Create a separate test bot
   for dev.
6. Transfer ownership: the bot (BotFather) to the church Telegram account, and the GitHub repo
   to the church organisation (the Pages address changes: update `MINIAPP_URL` and re-run the webhook
   script).
7. Data in dev stays in dev. People start fresh in prod, or you copy it across with a backup and restore.

## Costs

| Item | Cost |
| --- | --- |
| Telegram bot | Free |
| GitHub (repo, Actions, Pages) | Free for this use |
| Supabase dev (Free plan) | Free; pauses after a week of inactivity |
| Supabase production (Pro) | About US$25 a month per organisation; includes daily backups |
