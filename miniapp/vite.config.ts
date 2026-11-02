import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: the same build works at catoyang.github.io/Ebenezer/ and at a tunnel's root.
  base: "./",
  server: {
    // Allow the temporary Cloudflare tunnel address used to open the dev server inside Telegram.
    allowedHosts: [".trycloudflare.com"],
  },
});
