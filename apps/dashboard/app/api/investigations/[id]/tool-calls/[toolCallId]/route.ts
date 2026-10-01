import { proxyJsonToApi } from "../../../../upstream"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; toolCallId: string }> },
) {
  const params = await context.params
  return proxyJsonToApi(`/investigations/${params.id}/tool-calls/${params.toolCallId}`)
}
