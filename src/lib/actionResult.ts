export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

/** Friendlier text for common Postgres errors raised through PostgREST. */
export function dbErrorMessage(error: { message: string; code?: string }): string {
  if (error.code === "23P01") return "Those dates overlap one of her other active periods.";
  if (error.code === "23505") return "That already exists.";
  if (error.code === "42501") return "You do not have permission to do that.";
  return error.message;
}
