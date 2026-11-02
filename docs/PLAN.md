# Prayer Echo — Plan

Revised 2026-11-02. This file is the source of truth. It supersedes the original Claude Doc
("Prayer Companion – System Design", https://claude.ai/artifact/YRizw6dG287Y2LXcTKYEK7) wherever
they differ. The doc is still the reference for the overall architecture and the Telegram choice.

## Direction

**Individual first.** Every user is an independent person using the bot for their own prayer life.
Connecting a user to someone who shepherds or oversees them is a later phase, designed only once the
individual experience works. Nothing in Phases 0–2 assumes groups or leaders.

## What changed from the original design

| Area | Original doc | Now |
| --- | --- | --- |
| Groups and leaders | Cell groups, leader dashboard and leader digest in Phase 3 | Deferred and reframed as "Connections" (Phase 3, not yet designed). `cell_groups`, `group_members` and `share_with_leader` are removed from the schema. |
| Reminder time | Fixed nudge-time buttons; follow-ups due exactly N×24h later | User picks a reminder time during onboarding (presets or any hour) and can change it in `/settings`. Follow-ups land on the due date **at that time**. |
| Conversations | grammY conversations plugin + `bot_sessions` table | No plugin. Structured buttons for every choice. The one free-text prompt (`/pray` with no text) uses a single `users.awaiting` field. |
| Follow-up interval | 3 days / 1 week / 2 weeks / Custom | 3 days / 1 week / 2 weeks / 1 month. All buttons, no free-text "Custom". |
| Privacy notice and `/deletemydata` | Phase 4 | Phase 1. Real people's names and needs are stored from the first tester. |
| Blocked users | Not handled | `users.blocked_at` is set from Telegram's `my_chat_member` update or a 403 on send. The scheduler skips blocked users. |
| Duplicate updates | Not handled | `processed_updates` stores each `update_id` once, so a Telegram retry can't add a request twice. |
| Double-tapped buttons | Not handled | A unique index allows only one open follow-up per request. |
| Daily nudge | Always sent | Skipped if the user has already logged a prayer that day. |
| Local development | Not covered | Local Supabase in Docker, and the bot runs with polling (`npm run bot:dev`). Database tests use pgTAP. |
| Accounts | Not covered | Phase 0: organisation-owned accounts, transferable and not tied to one person (see [SETUP.md](SETUP.md)). |

## Phases

### Phase 0 — Accounts and foundation
- [x] Repo scaffold: Supabase project, migration, functions, scripts, tests
- [ ] Organisation-owned accounts: email, password manager, Telegram, GitHub, Supabase ([SETUP.md](SETUP.md))
- [ ] Dev and prod bots created in BotFather
- [ ] Dev Supabase project linked, migration pushed, functions deployed, webhook set

### Phase 1 — Personal MVP (bot + scheduler, no Mini App)
- [x] `/start`: privacy notice with Agree / No thanks. Declining deletes the user row.
- [x] Reminder-time picker: Morning 7 am / Midday 12 pm / Evening 9 pm / any hour from 5 am to 11 pm
- [x] Daily reminder on/off during onboarding
- [x] `/settings`: change reminder time, toggle daily reminder
- [x] `/prayed`: log a prayer
- [x] Daily nudge (scheduler): "Have you had a moment to pray today?" Yes / Not yet
- [x] `/deletemydata` with confirmation
- [x] Blocked-user handling, update de-duplication, consent gate
- [ ] **Next:** `/pray` → follow-up interval buttons → `prayer_requests` + `follow_ups` + `prayer_logs`
- [ ] **Next:** follow-up sending in `scheduler-tick` (`claim_due_follow_ups`, `FOR UPDATE SKIP LOCKED`)
- [ ] **Next:** follow-up buttons: Answered (optional note) / Still praying / Remind me tomorrow / Stop
- [ ] `/list`: active requests
- [ ] Contact person in the privacy notice (required by Singapore's PDPA before real users)
- [ ] Test with 2–3 friendly users for a week

### Phase 2 — My journey
- Mini App (React + Vite): streak, prayers per week, calendar heatmap, prayer list, settings
- `api` Edge Function that verifies `initData`
- Weekly personal digest (Monday morning, user's local time)
- Timezone setting (detected from the Mini App via `Intl`; Phase 1 assumes `Asia/Singapore`)

### Phase 3 — Connections (to be designed)
A user can invite someone to shepherd or oversee them. Questions to settle first:
- Who starts the connection, the individual or the shepherd? Is it one-to-one, or one shepherd with many people?
- What can a shepherd see? Default assumption: activity only, never prayer content.
- Is consent per connection, and can it be revoked at any time? (Assumed yes.)
- What counts as "may need a check-in": 7 days without a prayer, 14 days, or something else?
- Can a user share a single prayer request with their shepherd?

### Phase 4 — Polish
Other languages, data export, how long to keep answered and closed requests.

## Phase 1 behaviour

**Onboarding (`/start`):** privacy notice → Agree → "What time of day suits you for reminders?" →
preset or hour grid → "Would you also like a daily reminder to pray at that time?" → done.
Any command before consent gets "Please tap /start first".

**Reminder time:** stored as `users.reminder_time` (local) plus `users.timezone`. It controls both the
daily nudge and when follow-ups arrive. If the user never picks a time, follow-ups default to 8 pm and
there's no daily nudge.

**Daily nudge:** the scheduler runs every 5 minutes. It claims a nudge when the user's local time is
within an hour after their reminder time, they've consented, aren't blocked, have nudges on, and
haven't prayed today. The claim inserts `notifications(user_id, 'nudge', <local date>)`, whose unique key
prevents double sends. A failed send deletes the claim so the next run retries it.

**Prayer requests (next):** `/pray Sarah – surgery on Friday`, or `/pray` → "Who or what are you
praying for?" (Telegram ForceReply, tracked in `users.awaiting`) → "Follow up in?" 3 days / 1 week /
2 weeks / 1 month → saved, a prayer is logged, and the follow-up is scheduled at
`follow_up_due_at(user, days)`.

**Follow-up (next):** "A week ago you prayed for Sarah (surgery on Friday). How is it going?"
- Answered → mark answered, then offer an optional note.
- Still praying → log a prayer and schedule the next follow-up at the same interval.
- Remind me tomorrow → +1 day at the reminder time.
- Stop → close the request.

The bot then edits the message to show the choice.
