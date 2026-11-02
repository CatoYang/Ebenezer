// Which api the app talks to. Set VITE_API_URL at build time for another environment (e.g. prod);
// the default is the cloud dev project. The project ref isn't secret: the api checks Telegram's
// signature on every request.
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? "https://eruqnzwvcknwyqxgnnnz.supabase.co/functions/v1/api";
