// Local Mini App development inside Telegram:
//   1. starts the Vite dev server (live reload) on port 5173
//   2. opens a temporary Cloudflare tunnel to it (https://….trycloudflare.com, no account needed)
//   3. points the DEV bot's "Open" menu button at the tunnel
// Ctrl+C stops both and points the menu button back at MINIAPP_URL (the published app).
// The app still talks to the cloud dev api, so you see the same data as the deployed bot.
//
//   npm run miniapp:tunnel

import { Api } from "grammy";
import { requireEnv } from "../supabase/functions/_shared/env.ts";

const api = new Api(requireEnv("BOT_TOKEN"));
const published = Deno.env.get("MINIAPP_URL");

// Start the real binaries (not via npm/npx) so Ctrl+C can stop them directly.
const vite = new Deno.Command("node_modules/.bin/vite", {
  args: ["miniapp", "--port", "5173", "--strictPort"],
  stdout: "inherit",
  stderr: "inherit",
}).spawn();

const tunnel = new Deno.Command("node_modules/cloudflared/bin/cloudflared", {
  args: ["tunnel", "--no-autoupdate", "--url", "http://localhost:5173"],
  stdout: "null",
  stderr: "piped",
}).spawn();

async function restore() {
  await api.setChatMenuButton({
    menu_button: published
      ? { type: "web_app", text: "Open", web_app: { url: published } }
      : { type: "commands" },
  }).catch(() => {});
  console.log(`\nMenu button restored to ${published ?? "the commands list"}.`);
}

Deno.addSignalListener("SIGINT", async () => {
  await restore();
  try {
    vite.kill();
    tunnel.kill();
  } catch { /* already exited */ }
  Deno.exit(0);
});

// cloudflared prints the tunnel address on stderr.
const decoder = new TextDecoder();
let announced = false;
for await (const chunk of tunnel.stderr) {
  const match = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(decoder.decode(chunk));
  if (match && !announced) {
    announced = true;
    await api.setChatMenuButton({
      menu_button: { type: "web_app", text: "Open", web_app: { url: match[0] } },
    });
    console.log(`\nTunnel: ${match[0]}`);
    console.log(
      "The dev bot's Open button now loads your local Mini App (it can take ~10 s to start working).",
    );
    console.log("Close and reopen the chat in Telegram if the button doesn't appear. Ctrl+C to stop.\n");
  }
}
