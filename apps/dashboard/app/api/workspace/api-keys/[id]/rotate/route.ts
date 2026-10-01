import { proxyJsonToApi } from "../../../../upstream"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyJsonToApi(`/workspace/api-keys/${id}/rotate`, {
    method: "POST",
  })
}
