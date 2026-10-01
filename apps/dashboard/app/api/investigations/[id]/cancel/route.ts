import { proxyJsonToApi } from "../../../upstream"

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  return proxyJsonToApi(`/investigations/${params.id}/cancel`, { method: "POST" })
}
