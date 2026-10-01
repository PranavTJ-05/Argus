import { proxyJsonToApi } from "../../upstream"

export async function GET() {
  return proxyJsonToApi("/workspace/api-keys")
}

export async function POST(request: Request) {
  return proxyJsonToApi("/workspace/api-keys", {
    body: await request.text(),
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    method: "POST",
  })
}
