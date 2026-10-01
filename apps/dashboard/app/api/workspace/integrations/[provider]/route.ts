import { proxyJsonToApi } from "../../../upstream"

export async function PUT(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  return proxyJsonToApi(`/workspace/integrations/${provider}`, {
    body: await request.text(),
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    method: "PUT",
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  return proxyJsonToApi(`/workspace/integrations/${provider}`, {
    method: "DELETE",
  })
}
