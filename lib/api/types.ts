// ── Shared enums ──────────────────────────────────────────────────────────────

export type StreamKind = 'BUSINESS' | 'SALARY'
export type TransactionType = 'CREDIT' | 'DEBIT' | 'TRANSFER'
export type TxStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED'
export type ProposalStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED'

// ── Pagination ────────────────────────────────────────────────────────────────

export interface Page<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// ── Entities ──────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string
  name: string
  email: string
  createdAt: string
}

export interface ApiVirtualAccount {
  id: string
  accountNumber: string
  accountName: string
  bankName: string
  balance: number
  currency: string
}

export interface ApiIncomeStream {
  id: string
  name: string
  kind: StreamKind
  category: string | null
  isActive: boolean
  currency: string
  virtualAccount: ApiVirtualAccount | null
  createdAt: string
}

export interface ApiTransaction {
  id: string
  type: TransactionType
  amount: number
  currency: string
  description: string | null
  status: TxStatus
  incomeStreamId: string | null
  streamName: string | null
  createdAt: string
}

export interface ApiProposal {
  id: string
  title: string
  description: string
  amount: number
  currency: string
  status: ProposalStatus
  aiGenerated: boolean
  createdAt: string
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalBalance: number
  monthlyIncome: number
  monthlyProfit: number
  activeStreams: number
  currency: 'NGN'
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
}

export interface AuthResponse {
  user: ApiUser
  token: string
}

// ── Onboarding ────────────────────────────────────────────────────────────────
// Mirrors lib/onboarding/types.ts but scoped to the API contract so the
// client library has no direct dependency on internal lib modules.

export interface ParseStreamsRequest {
  rawInput: string
}

export interface ParseStreamsResponse {
  streams: ParsedStream[]
}

export interface ParsedStream {
  name: string
  kind: StreamKind
  category: string
}

export interface ConfirmStreamsRequest {
  streams: ConfirmableStream[]
}

export interface ConfirmStreamsResponse {
  streams: CreatedStream[]
}

export interface ConfirmableStream {
  name: string
  kind: StreamKind
  category: string
}

export interface CreatedStream {
  id: string
  name: string
  kind: StreamKind
  category: string
  virtualAccount?: {
    accountNumber: string
    accountName: string
    bankName: string
  }
}

// ── Streams ───────────────────────────────────────────────────────────────────

export interface CreateStreamRequest {
  name: string
  kind: StreamKind
  category?: string
}

export interface UpdateStreamRequest {
  name?: string
  isActive?: boolean
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface ChatRequest {
  message: string
}

export interface ChatResponse {
  reply: string
  citations?: string[]
}
