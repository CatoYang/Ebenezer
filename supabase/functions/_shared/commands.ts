// The bot's command menu (set by set-webhook.ts and dev-bot.ts). Kept free of grammY so tests can import it.
// Every command here must also appear in the guide in messages.ts (messages_test.ts checks).

import { APP_NAME } from "./messages.ts";

// The app comes first: it's the main way to use the bot.
export const COMMANDS = [
  { command: "app", description: "Open the app" },
  { command: "pray", description: "Add an intention" },
  { command: "list", description: "What you're praying for" },
  { command: "prayed", description: "Record that you prayed" },
  { command: "studied", description: "Record Bible study time" },
  { command: "settings", description: "Reminder time, daily reminder, weekly summary" },
  { command: "help", description: `How to use ${APP_NAME}` },
  { command: "deletemydata", description: "Delete everything stored about you" },
];
