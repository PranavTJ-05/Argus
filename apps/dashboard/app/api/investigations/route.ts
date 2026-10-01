import { createInvestigationRequestSchema, investigationSummarySchema } from "@argus/shared-types"

import { proxyJsonToApi } from "../upstream"

export async function GET() {
  return proxyJsonToApi("/investigations")
}

export async function POST(request: Request) {
  const parsedBody = createInvestigationRequestSchema.safeParse(await request.json())

  if (!parsedBody.success) {
    const requestId = crypto.randomUUID()

    return Response.json(
      {
        error: "invalid_request",
        message: "Investigation request is invalid.",
        issues: parsedBody.error.issues,
      },
      {
        headers: { "x-argus-request-id": requestId },
        status: 400,
      },
    )
  }

  const response = await proxyJsonToApi("/investigations", {
    body: JSON.stringify(parsedBody.data),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  })

  const responseBody: unknown = await response.json().catch(() => null)
  const requestId = response.headers.get("x-argus-request-id") ?? crypto.randomUUID()

  if (!response.ok) {
    return Response.json(
      {
        error: "api_request_failed",
        message: "Argus API rejected the investigation request.",
        upstream: responseBody,
      },
      {
        headers: { "x-argus-request-id": requestId },
        status: response.status,
      },
    )
  }

  return Response.json(investigationSummarySchema.parse(responseBody), {
    headers: { "x-argus-request-id": requestId },
    status: 201,
  })
}
