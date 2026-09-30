"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { FormEvent } from "react"
import { useState } from "react"

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [workspaceName, setWorkspaceName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const response = await fetch("/api/auth/signup", {
      body: JSON.stringify({ email, password, workspaceName }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    })

    if (!response.ok) {
      setSubmitting(false)
      setError(
        response.status === 409 ? "Email is already registered." : "Could not create workspace.",
      )
      return
    }

    router.replace("/")
    router.refresh()
  }

  return (
    <main className="tc-login-shell">
      <section className="tc-login-panel">
        <div className="tc-logo">T</div>
        <h1>Create your Argus workspace</h1>
        <p>Start with a workspace, then create an API key and send your first incident.</p>
        <form className="tc-login-form" onSubmit={onSubmit}>
          <label>
            Work email
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Workspace name
            <input
              autoComplete="organization"
              onChange={(event) => setWorkspaceName(event.target.value)}
              required
              value={workspaceName}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="new-password"
              minLength={12}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? <div className="tc-login-error">{error}</div> : null}
          <button className="tc-primary-button" disabled={submitting} type="submit">
            {submitting ? "Creating..." : "Create workspace"}
          </button>
        </form>
        <p className="tc-auth-switch">
          Already have a workspace? <Link href="/login">Log in</Link>
        </p>
      </section>
    </main>
  )
}
