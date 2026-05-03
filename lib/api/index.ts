import { http } from './client'
import type {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  DashboardStats,
  ApiIncomeStream,
  CreateStreamRequest,
  UpdateStreamRequest,
  ApiTransaction,
  Page,
  ApiProposal,
  ParseStreamsRequest,
  ParseStreamsResponse,
  ConfirmStreamsRequest,
  ConfirmStreamsResponse,
  ChatRequest,
  ChatResponse,
} from './types'

export * from './types'
export { ApiError, createApiClient } from './client'

// ── Auth ──────────────────────────────────────────────────────────────────────
// Note: login goes through NextAuth's signIn('credentials') in login form
// components — NOT through this client — so NextAuth can manage the session
// cookie. Use api.auth.login() only if you switch to a bearer-token backend.
//
// To wire in Oseni's backend later:
//   1. Set NEXT_PUBLIC_API_URL=https://api.yourbackend.com
//   2. Call api.auth.login() from the login form and save the returned token
//   3. Update NextAuth's authorize() in auth.ts to call api.auth.login() too

const auth = {
  register: (body: RegisterRequest) => http.post<{ success: true }>('/auth/register', body),

  login: (body: LoginRequest) => http.post<AuthResponse>('/auth/login', body),

  me: () => http.get<AuthResponse['user']>('/auth/me'),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

const dashboard = {
  getStats: () => http.get<DashboardStats>('/dashboard'),
}

// ── Income Streams ────────────────────────────────────────────────────────────

const streams = {
  list: () => http.get<ApiIncomeStream[]>('/streams'),

  create: (body: CreateStreamRequest) => http.post<ApiIncomeStream>('/streams', body),

  update: (id: string, body: UpdateStreamRequest) =>
    http.patch<ApiIncomeStream>(`/streams/${id}`, body),

  delete: (id: string) => http.delete<void>(`/streams/${id}`),
}

// ── Transactions ──────────────────────────────────────────────────────────────

const transactions = {
  list: (params?: { streamId?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams()
    if (params?.streamId) qs.set('streamId', params.streamId)
    if (params?.page != null) qs.set('page', String(params.page))
    if (params?.pageSize != null) qs.set('pageSize', String(params.pageSize))
    const query = qs.toString()
    return http.get<Page<ApiTransaction>>(`/transactions${query ? `?${query}` : ''}`)
  },
}

// ── Proposals ────────────────────────────────────────────────────────────────

const proposals = {
  list: () => http.get<ApiProposal[]>('/proposals'),

  approve: (id: string) => http.post<ApiProposal>(`/proposals/${id}/approve`),

  reject: (id: string) => http.post<ApiProposal>(`/proposals/${id}/reject`),
}

// ── Onboarding ────────────────────────────────────────────────────────────────

const onboarding = {
  parseStreams: (body: ParseStreamsRequest) =>
    http.post<ParseStreamsResponse>('/onboarding/parse-streams', body),

  confirmStreams: (body: ConfirmStreamsRequest) =>
    http.post<ConfirmStreamsResponse>('/onboarding/confirm', body),
}

// ── Chat ──────────────────────────────────────────────────────────────────────

const chat = {
  send: (body: ChatRequest) => http.post<ChatResponse>('/chat', body),
}

// ── Default export ────────────────────────────────────────────────────────────

const api = { auth, dashboard, streams, transactions, proposals, onboarding, chat }
export default api
