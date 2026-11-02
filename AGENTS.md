# AGENTS.md

Guidance for coding agents (Claude Code, Codex, etc.) working in this repository.

## Project

**Prayer Echo** is a Telegram bot (and later a Mini App) for personal prayer life. Users record
what they're praying for and when they pray. The bot follows up on each request ("How is Sarah
doing?") and sends a daily reminder at a time each user chooses.

The name may change. User-facing text gets it only from `APP_NAME` in `messages.ts`; never hardcode it.
(The Claude Doc below was written under the earlier name "Prayer Companion".)

**Individual first.** Every user is independent. Connecting users to someone who shepherds them is a
later, not-yet-designed phase. Don't add group or leader concepts until then.

- Plan, phases and status: [docs/PLAN.md](docs/PLAN.md). This is the source of truth.
- Accounts, local dev and deploy: [docs/SETUP.md](docs/SETUP.md)
- Original design (architecture background; superseded where PLAN.md differs):
  Claude Doc "Prayer Companion – System Design", https://claude.ai/artifact/YRizw6dG287Y2LXcTKYEK7

## Architecture

Telegram → Supabase only. Everything is TypeScript.

```
Telegram ── webhook ──▶ telegram-bot    Edge Function (grammY): commands and buttons
Telegram ◀── sends ──── scheduler-tick  Edge Function: due nudges (follow-ups next)
                        Supabase Cron ─▶ POSTs scheduler-tick every 5 min, URL + secret from Vault
                        Postgres      ◀─ all reads/writes via the service role
```

## Layout

```
supabase/
  config.toml                  verify_jwt = false for both functions; shared import map
  migrations/                  every schema change is a new migration
  tests/database/*.test.sql    pgTAP tests (scheduling, idempotency, constraints)
  functions/
    deno.json                  import map shared by all functions and scripts
    _shared/
      bot.ts                   createBot(): middleware order + command/callback routing
      callbacks.ts             all inline-button callback data (encode/parse, 64-byte limit)
      keyboards.ts             all inline keyboards
      messages.ts              ALL user-facing wording
      handlers/                onboarding.ts, prayer.ts, account.ts
      context.ts db.ts env.ts telegram.ts
    telegram-bot/index.ts      webhook entry
    scheduler-tick/            cron entry + nudges.ts
scripts/
  dev-bot.ts                   local long-polling bot against local Supabase
  set-webhook.ts               register webhook + command menu for a deployed env
docs/                          PLAN.md, SETUP.md
```

## Commands

```bash
npm install            # Supabase CLI + Deno as local dev dependencies (no global installs needed)
npm run db:start       # local Supabase in Docker, applies migrations
npm run bot:dev        # run the bot locally with polling (needs supabase/functions/.env)
npm test               # unit (deno test) + database (supabase test db)
npm run test:unit      # deno tests only: supabase/functions/**/*_test.ts
npm run test:db        # pgTAP only
npm run check          # deno check + lint + fmt --check
npm run fmt
npm run deploy         # deploy both functions to the linked project
```

Run `npm run check` and `npm test` before calling work done.

## Data model (see the migration for exact definitions)

| Table | Notes |
| --- | --- |
| `users` | `telegram_user_id` unique; `timezone` (default `Asia/Singapore`); `reminder_time` (local `time`, null until chosen); `nudges_enabled`; `privacy_accepted_at`; `awaiting` (jsonb, the one pending free-text prompt); `blocked_at` |
| `prayer_requests` | `title` (who/what), `details`, `status` active/answered/closed, `follow_up_days`, `answer_note` |
| `follow_ups` | `due_at`, `status` pending/sent/responded/cancelled, `response`; **unique open follow-up per request** |
| `prayer_logs` | one row per prayer; `source` command/nudge/request/follow_up/miniapp. Basis for all stats |
| `notifications` | scheduled sends; unique (`user_id`, `kind`, `period_key`) makes the scheduler idempotent |
| `processed_updates` | Telegram `update_id`s already handled (pruned after 3 days by cron) |

SQL functions: `follow_up_due_at(user_id, days)` (N local days out, at the user's reminder time) and
`claim_due_nudges(limit)`. Do time-zone maths in SQL (`at time zone`), not in JS.

## Rules

**Bot design**
- No grammY conversations plugin and no session middleware. Every choice is an inline button. Callback
  data is defined only in `callbacks.ts`. A free-text prompt sets `users.awaiting` and clears it when answered.
- Middleware order in `bot.ts` matters: de-duplicate → private chats only → load user → `my_chat_member`
  → `/start` → consent gate → everything else. New commands go after the consent gate.
- Wording lives in `messages.ts`. Add button labels to `label` there.
- After a button tap, edit the original message (`editFromButton`) so the chat stays tidy, and always
  `answerCallbackQuery`.

**Scheduler**
- Claim, then send. The claim is a single SQL statement: an insert into `notifications` with
  `on conflict do nothing`, or an update guarded by `status` / `FOR UPDATE SKIP LOCKED`. On a failed send,
  release the claim so the next tick retries it. On a 403, mark the user blocked (`sendOrMarkBlocked`).
- Never send to users with `blocked_at` set or `privacy_accepted_at` null.

**Security and privacy**
- `telegram-bot` checks `X-Telegram-Bot-Api-Secret-Token` before doing anything, because grammY's own
  check runs after a `getMe` call. `scheduler-tick` checks `x-scheduler-secret`. Both use `secretsMatch`.
- RLS is on for every table with no policies; `anon`/`authenticated` have no grants. Only the service role
  (Edge Functions) touches data. Never add client-side DB access or public policies.
- Secrets live in `supabase/functions/.env` (local, git-ignored) and in Supabase secrets/Vault. Never commit them.
- Prayer content is sensitive personal data under Singapore's PDPA. Never log message text, request
  titles or details. Log error messages only.
- `/deletemydata` deletes the `users` row. Every user-owned table must reference `users` with
  `on delete cascade`.

**Deno**
- Edge Functions run on Deno (the local edge runtime is Deno 2.1-compatible). Use the `deno.json` import
  map (`npm:`/`jsr:`). Unit tests go next to the code as `*_test.ts`.
