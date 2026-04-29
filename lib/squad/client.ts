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

// ── Internal request helper ───────────────────────────────────────────────────

async function request<T>(method: 'POST' | 'GET', path: string, body?: unknown): Promise<T> {
  const apiKey = process.env.SQUAD_SECRET_KEY
  if (!apiKey) throw new Error('SQUAD_SECRET_KEY environment variable is not set')

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[squad] ${method} ${path}`, body ? JSON.stringify(body, null, 2) : '')
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
    console.error('[squad] API error response:', JSON.stringify(json, null, 2))
    throw new SquadError(json.message ?? 'Squad API error', response.status)
  }

  return json.data
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Provisions a dedicated virtual NUBAN for a user's income stream.
 * Call this whenever a new user signs up or adds an income stream.
 */
export async function createVirtualAccount(
  params: CreateVirtualAccountParams
): Promise<VirtualAccountResult> {
  // Mock mode: bypass Squad API when sandbox limit is hit or in unit tests.
  // Set SQUAD_MOCK=true in .env to enable. Never set this in production.
  if (process.env.SQUAD_MOCK === 'true') {
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

/**
 * Generates a hosted checkout URL the user can share with their customers.
 * Used for "Request Payment" and invoice flows.
 */
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

/**
 * Moves money out of a virtual account to any Nigerian bank account.
 * Called when a user approves an AI-generated savings or tax proposal.
 */
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
