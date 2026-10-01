import { proxyJsonToApi } from "../../upstream"

export async function GET() {
  return proxyJsonToApi("/workspace/integrations")
}
