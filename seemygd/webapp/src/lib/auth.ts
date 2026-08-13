const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ""

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) localStorage.setItem("auth_token", token)
  else localStorage.removeItem("auth_token")
}

export function getAuthToken(): string | null {
  if (!authToken) authToken = localStorage.getItem("auth_token")
  return authToken
}

// Better Auth returns JSON, but if a proxy/gateway returns an HTML error page
// (timeout, 502, wrong route on a custom domain) res.json() throws a cryptic
// "Unexpected token '<'... is not valid JSON". Parse safely and surface a clear
// message instead.
async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

export async function signUp(name: string, email: string, password: string) {
  const res = await fetch(`${BACKEND_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  })
  const data = await parseJsonSafe(res)
  if (!res.ok) {
    const err = data.error as { message?: string } | undefined
    throw new Error(err?.message || (data.message as string) || "Sign up failed. Please try again.")
  }
  if (data.token) setAuthToken(data.token as string)
  return data
}

export async function signIn(email: string, password: string) {
  let res: Response
  try {
    res = await fetch(`${BACKEND_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new Error("Can't reach the server. Please check your connection and try again.")
  }
  const data = await parseJsonSafe(res)
  if (!res.ok) {
    const err = data.error as { message?: string } | undefined
    const msg = err?.message || (data.message as string)
    if (msg) throw new Error(msg)
    // No parseable error body — distinguish a real auth failure from a server
    // outage (502/503/504 or empty body) so we don't blame the user's password.
    if (res.status >= 500) {
      throw new Error("The server is temporarily unavailable. Please try again in a moment.")
    }
    throw new Error("Invalid email or password")
  }
  if (data.token) setAuthToken(data.token as string)
  return data
}

export async function signOut() {
  setAuthToken(null)
}

export async function getSession() {
  const token = getAuthToken()
  if (!token) return null
  const res = await fetch(`${BACKEND_URL}/api/auth/get-session`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return await parseJsonSafe(res)
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
