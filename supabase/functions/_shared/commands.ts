// The bot's command menu (set by set-webhook.ts and dev-bot.ts). Kept free of grammY so tests can import it.
// Every command here must also appear in the guide in messages.ts (messages_test.ts checks).

import { APP_NAME } from "./messages.ts";

export const COMMANDS = [
  { command: "pray", description: "Add something to pray for" },
  { command: "list", description: "What you're praying for" },
  { command: "app", description: "Open the app" },
  { command: "prayed", description: "Record that you prayed" },
  { command: "settings", description: "Reminder time, daily reminder, weekly summary" },
  { command: "help", description: `How to use ${APP_NAME}` },
  { command: "deletemydata", description: "Delete everything stored about you" },
];
