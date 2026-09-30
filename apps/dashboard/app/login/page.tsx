"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { FormEvent } from "react"
import { useState } from "react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const response = await fetch("/api/auth/login", {
      body: JSON.stringify({ email, password }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    })

    if (!response.ok) {
      setSubmitting(false)
      setError("Email or password is incorrect.")
      return
    }

    const next = new URLSearchParams(window.location.search).get("next") || "/"
    router.replace(next)
    router.refresh()
  }

  return (
    <main className="tc-login-shell">
      <section className="tc-login-panel">
        <div className="tc-logo">T</div>
        <h1>Sign in to Argus</h1>
        <p>Use your workspace credentials to review investigations, evidence, and reports.</p>
        <form className="tc-login-form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? <div className="tc-login-error">{error}</div> : null}
          <button className="tc-primary-button" disabled={submitting} type="submit">
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="tc-auth-switch">
          New to Argus? <Link href="/signup">Create a workspace</Link>
        </p>
      </section>
    </main>
  )
}
