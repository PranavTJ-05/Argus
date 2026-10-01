import { proxyJsonToApi } from "../../../upstream"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  return proxyJsonToApi(`/investigations/${params.id}/report`)
}
