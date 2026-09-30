import { type NextRequest, NextResponse } from "next/server"

import { sessionCookieName } from "./app/auth"

const publicPathPrefixes = [
  "/landing",
  "/login",
  "/signup",
  "/api/auth",
  "/api/health",
  "/_next",
  "/favicon.ico",
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (publicPathPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  if (request.cookies.has(sessionCookieName)) {
    return NextResponse.next()
  }

  const landingUrl = new URL("/landing", request.url)
  landingUrl.searchParams.set("next", pathname)
  return NextResponse.redirect(landingUrl)
}

export const config = {
  matcher: ["/((?!.*\\.).*)"],
}
