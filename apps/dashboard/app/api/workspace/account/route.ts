import { proxyJsonToApi } from "../../upstream"

export async function GET() {
  return proxyJsonToApi("/workspace/account")
}

export async function PUT(request: Request) {
  return proxyJsonToApi("/workspace/account", {
    body: await request.text(),
    headers: {
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    method: "PUT",
  })
}
