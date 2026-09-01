import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME, type Session } from "./auth";

// Server-only helper (Server Components + Route Handlers) to read who's
// logged in. Middleware already blocks unauthenticated/wrong-role requests
// from reaching protected routes at all — this is for reading the session
// once we know a valid one exists (e.g. scoping "my articles" to the
// logged-in contributor's own user id).
export async function getSession(): Promise<Session | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
