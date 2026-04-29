import type {
  CreateVirtualAccountParams,
  VirtualAccountResult,
  GeneratePaymentLinkParams,
  PaymentLinkResult,
  ExecuteTransferParams,
  TransferResult,
  SquadApiResponse,
} from './types'

const SQUAD_BASE_URL =
  process.env.SQUAD_ENV === 'production'
    ? 'https://api-d.squadco.com'
    : 'https://sandbox-api-d.squadco.com'

const IS_PROD = process.env.NODE_ENV === 'production'

// ── Error ────────────────────────────────────────────────────────────────────

export class SquadError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message)
    this.name = 'SquadError'
  }
}

// ── PII scrubber for dev logs ─────────────────────────────────────────────────
// Removes fields that could contain personal data before printing to stdout.
const PII_FIELDS = new Set([
  'email',
  'first_name',
  'last_name',
  'mobile_num',
  'dob',
  'address',
  'bvn',
])

function redact(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([k, v]) => [
      k,
      PII_FIELDS.has(k) ? '[redacted]' : v,
    ])
  )
}

// ── Internal request helper ───────────────────────────────────────────────────

async function request<T>(method: 'POST' | 'GET', path: string, body?: unknown): Promise<T> {
  const apiKey = process.env.SQUAD_SECRET_KEY
  if (!apiKey) throw new Error('SQUAD_SECRET_KEY environment variable is not set')

  if (!IS_PROD) {
    console.log(`[squad] ${method} ${path}`, body ? JSON.stringify(redact(body), null, 2) : '')
  }

  const response = await fetch(`${SQUAD_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const json: SquadApiResponse<T> = await response.json()

  if (!response.ok || !json.success) {
    // Log status and message only — never log the full response body in case it echoes PII.
    console.error(`[squad] ${response.status} error on ${method} ${path}: ${json.message}`)
    throw new SquadError(json.message ?? 'Squad API error', response.status)
  }

  return json.data
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function createVirtualAccount(
  params: CreateVirtualAccountParams
): Promise<VirtualAccountResult> {
  // Mock mode: bypass Squad API when sandbox limit is hit or during local testing.
  // Blocked in production so this can never be accidentally enabled on live data.
  if (process.env.SQUAD_MOCK === 'true') {
    if (IS_PROD) throw new Error('SQUAD_MOCK must not be enabled in production')
    const suffix = params.customerIdentifier.slice(-6).replace(/\D/g, '').padStart(6, '0')
    return {
      accountNumber: `900${suffix}0001`,
      accountName: `${params.firstName} ${params.lastName}`,
      bankName: 'GTBank (Mock)',
      squadReference: `mock-${params.customerIdentifier}`,
    }
  }

  const data = await request<{
    virtual_account_number: string
    beneficiary_account: string
    bank_name: string
    id: string
  }>('POST', '/virtual-account', {
    customer_identifier: params.customerIdentifier,
    first_name: params.firstName,
    last_name: params.lastName,
    mobile_num: params.mobileNumber,
    dob: params.dob,
    address: params.address,
    gender: params.gender,
    beneficiary_account: params.beneficiaryAccount,
    email: params.email,
    bvn: params.bvn,
  })

  return {
    accountNumber: data.virtual_account_number,
    accountName: data.beneficiary_account,
    bankName: data.bank_name,
    squadReference: data.id,
  }
}

export async function generatePaymentLink(
  params: GeneratePaymentLinkParams
): Promise<PaymentLinkResult> {
  const data = await request<{
    checkout_url: string
    transaction_ref: string
  }>('POST', '/transaction/initiate', {
    amount: params.amountKobo,
    email: params.email,
    initiate_type: 'inline',
    currency: 'NGN',
    transaction_ref: params.transactionRef,
    callback_url: params.callbackUrl,
    pass_charge: params.passCharge ?? false,
    payment_channels: params.channels ?? ['card', 'bank', 'transfer'],
  })

  return {
    checkoutUrl: data.checkout_url,
    transactionRef: data.transaction_ref,
  }
}

export async function executeTransfer(params: ExecuteTransferParams): Promise<TransferResult> {
  const data = await request<{
    transaction_ref: string
    status: string
    amount: number
  }>('POST', '/payout/transfer', {
    transaction_ref: params.transactionRef,
    amount: params.amountKobo,
    bank_code: params.bankCode,
    account_number: params.accountNumber,
    account_name: params.accountName,
    currency_id: 'NGN',
    remark: params.remark ?? 'Kova transfer',
  })

  return {
    transactionRef: data.transaction_ref,
    status: data.status,
    amountKobo: data.amount,
  }
}
