import { getDashboardSessionToken } from "../auth"

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export async function proxyJsonToApi(path: string, init: RequestInit = {}): Promise<Response> {
  const sessionToken = await getDashboardSessionToken()
  const proxyRequestId = crypto.randomUUID()

  if (!sessionToken) {
    return Response.json(
      { error: "unauthorized", message: "Missing session." },
      { headers: { "x-argus-request-id": proxyRequestId }, status: 401 },
    )
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${sessionToken}`,
    },
  })
  const body: unknown = await response.json().catch(() => null)
  const upstreamRequestId = response.headers.get("x-argus-request-id") ?? proxyRequestId

  return Response.json(body, {
    headers: { "x-argus-request-id": upstreamRequestId },
    status: response.status,
  })
}

export async function proxyEventStreamToApi(path: string): Promise<Response> {
  const sessionToken = await getDashboardSessionToken()

  if (!sessionToken) {
    return Response.json({ error: "unauthorized", message: "Missing session." }, { status: 401 })
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      authorization: `Bearer ${sessionToken}`,
    },
  })

  if (!response.ok || !response.body) {
    const body: unknown = await response.json().catch(() => null)
    return Response.json(body, { status: response.status })
  }

  return new Response(response.body, {
    headers: {
      "cache-control": "no-cache",
      "content-type": response.headers.get("content-type") ?? "text/event-stream; charset=utf-8",
    },
    status: response.status,
  })
}
