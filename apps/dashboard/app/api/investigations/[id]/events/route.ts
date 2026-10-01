import { proxyEventStreamToApi } from "../../../upstream"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const url = new URL(request.url)
  const after = url.searchParams.get("after") ?? "0"

  return proxyEventStreamToApi(`/investigations/${params.id}/events?after=${after}`)
}
