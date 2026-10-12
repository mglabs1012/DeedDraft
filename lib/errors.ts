/**
 * Turns database / storage errors into messages a user can act on. The raw
 * error (codes, table names, constraint names) is logged on the server only.
 */

type ErrorLike = { code?: string; message?: string; statusCode?: string | number; status?: number; details?: string } | null | undefined;

const byCode: Record<string, string> = {
  "23505": "This already exists. Refresh the page and try again.",
  "23503": "This item is linked to other records and cannot be changed this way.",
  "23514": "Some of the details are not valid.",
  "22001": "One of the values is too long.",
  "42501": "You do not have permission to do this.",
  PGRST301: "Your session has expired. Please sign in again.",
  PGRST116: "This item was not found. It may have been deleted.",
  "42P01": "This feature needs a database update. Ask your administrator to run the latest Supabase migration.",
  PGRST205: "This feature needs a database update. Ask your administrator to run the latest Supabase migration.",
  "57014": "The database took too long to respond. Please try again.",
  "53300": "The database is busy. Please try again in a moment.",
};

export function userMessage(error: ErrorLike, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  const message = error.message ?? "";
  const status = Number(error.statusCode ?? error.status);
  const known =
    (error.code && byCode[error.code]) ||
    (status === 413 || /payload too large|maximum allowed size/i.test(message) ? "The file is too large." : "") ||
    (/fetch failed|network|ECONNRESET|ETIMEDOUT/i.test(message) ? "Could not reach the server. Check your internet connection and try again." : "") ||
    (/row-level security|permission denied/i.test(message) ? "You do not have permission to do this." : "") ||
    (/JWT expired|invalid jwt/i.test(message) ? "Your session has expired. Please sign in again." : "");
  if (!known) console.error(JSON.stringify({ level: "error", msg: "database error", code: error.code ?? null, status: Number.isFinite(status) ? status : null, error: message.slice(0, 500) }));
  return known || fallback;
}
