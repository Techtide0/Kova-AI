// Typed error class — lets callers distinguish API failures from network errors.
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'ApiError'
  }

  get isUnauthorized() {
    return this.status === 401
  }
  get isNotFound() {
    return this.status === 404
  }
  get isServerError() {
    return this.status >= 500
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

// Base URL resolution order:
//   1. NEXT_PUBLIC_API_URL — set this to Oseni's backend URL when it is ready
//   2. '/api'              — our own Next.js routes (relative, browser-only)
function resolveBaseUrl(): string {
  const external = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : undefined
  return external ? external.replace(/\/$/, '') : '/api'
}

export function createApiClient(options?: { token?: string }) {
  const baseUrl = resolveBaseUrl()

  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {}
    if (body != null) headers['Content-Type'] = 'application/json'
    if (options?.token) headers['Authorization'] = `Bearer ${options.token}`

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        const data = await res.json()
        message = (data?.error as string) ?? (data?.message as string) ?? message
      } catch {
        // non-JSON error body — keep the default message
      }
      throw new ApiError(message, res.status)
    }

    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
    delete: <T>(path: string) => request<T>('DELETE', path),
  }
}

// Singleton — cookies are sent automatically for same-origin requests,
// so no explicit token is needed when calling our own /api routes.
export const http = createApiClient()
