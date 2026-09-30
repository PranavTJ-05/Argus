import { getDashboardSessionToken, getSessionCookieOptions, sessionCookieName } from "../../../auth"

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export async function POST() {
  const sessionToken = await getDashboardSessionToken()

  if (sessionToken) {
    await fetch(`${apiBaseUrl}/auth/logout`, {
      headers: {
        authorization: `Bearer ${sessionToken}`,
      },
      method: "POST",
    }).catch(() => null)
  }

  const headers = new Headers()
  headers.append(
    "set-cookie",
    serializeCookie(sessionCookieName, "", {
      ...getSessionCookieOptions(),
      expires: new Date(0),
    }),
  )

  return Response.json({ ok: true }, { headers })
}

function serializeCookie(
  name: string,
  value: string,
  options: ReturnType<typeof getSessionCookieOptions>,
): string {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ]

  if (options.secure) {
    parts.push("Secure")
  }

  return parts.join("; ")
}
