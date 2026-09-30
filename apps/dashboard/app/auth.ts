import { cookies } from "next/headers"

export const sessionCookieName = "argus_session"

export async function getDashboardSessionToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(sessionCookieName)?.value ?? null
}

export function getSessionCookieOptions(expiresAt?: string) {
  return {
    expires: expiresAt ? new Date(expiresAt) : undefined,
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  }
}
