import { getSessionCookieOptions, sessionCookieName } from "../../../auth"

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export async function POST(request: Request) {
  const response = await fetch(`${apiBaseUrl}/auth/signup`, {
    body: JSON.stringify(await request.json()),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  })
  const body: unknown = await response.json().catch(() => null)

  if (!response.ok || !isSignupResponse(body)) {
    return Response.json(body ?? { error: "signup_failed" }, { status: response.status })
  }

  const headers = new Headers()
  headers.append(
    "set-cookie",
    serializeCookie(
      sessionCookieName,
      body.sessionToken,
      getSessionCookieOptions(body.session.expiresAt),
    ),
  )

  return Response.json({ session: body.session }, { headers, status: 201 })
}

function isSignupResponse(value: unknown): value is {
  sessionToken: string
  session: { expiresAt: string }
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "sessionToken" in value &&
    typeof value.sessionToken === "string" &&
    "session" in value &&
    typeof value.session === "object" &&
    value.session !== null &&
    "expiresAt" in value.session &&
    typeof value.session.expiresAt === "string"
  )
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
    `Expires=${options.expires?.toUTCString()}`,
  ]

  if (options.secure) {
    parts.push("Secure")
  }

  return parts.filter((part) => !part.endsWith("undefined")).join("; ")
}
