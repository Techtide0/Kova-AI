// ---------- Virtual Account ----------

export interface CreateVirtualAccountParams {
  customerIdentifier: string // unique per user — use the user's DB id
  firstName: string
  lastName: string
  mobileNumber: string
  dob: string // DD/MM/YYYY — required by Squad; collect from profile in production
  address: string // required by Squad; collect from profile in production
  gender: '1' | '2' // '1' = Male, '2' = Female
  beneficiaryAccount: string // settlement bank account NUBAN (10 digits)
  email: string
  bvn?: string
}

export interface VirtualAccountResult {
  accountNumber: string
  accountName: string
  bankName: string
  squadReference: string // Squad's internal account id
}

// ---------- Payment Link ----------

export type PaymentChannel = 'card' | 'bank' | 'ussd' | 'transfer'

export interface GeneratePaymentLinkParams {
  amountKobo: number // always in kobo (100 kobo = ₦1)
  email: string
  transactionRef: string // caller supplies this so we can track it
  callbackUrl: string
  channels?: PaymentChannel[]
  passCharge?: boolean // if true, transaction fee is passed to the payer
}

export interface PaymentLinkResult {
  checkoutUrl: string
  transactionRef: string
}

// ---------- Transfer (Payout) ----------

export interface ExecuteTransferParams {
  amountKobo: number
  bankCode: string
  accountNumber: string
  accountName: string
  transactionRef: string
  remark?: string
}

export interface TransferResult {
  transactionRef: string
  status: string
  amountKobo: number
}

// ---------- Internal ----------

export interface SquadApiResponse<T> {
  status: number
  success: boolean
  message: string
  data: T
}
