import { getDashboardSessionToken } from "../../../auth"

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export async function GET() {
  const sessionToken = await getDashboardSessionToken()

  if (!sessionToken) {
    return Response.json({ error: "unauthorized", message: "Missing session." }, { status: 401 })
  }

  const response = await fetch(`${apiBaseUrl}/auth/me`, {
    headers: {
      authorization: `Bearer ${sessionToken}`,
    },
  })
  const body: unknown = await response.json().catch(() => null)

  return Response.json(body, { status: response.status })
}
