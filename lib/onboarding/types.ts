// Shared types for the onboarding flow.
// Both API endpoints and the frontend should import from here — this is the
// contract that keeps the parse → review → confirm pipeline consistent.

export type StreamKind = 'BUSINESS' | 'SALARY'

// What Claude returns after parsing the user's raw text.
// Nothing is saved to the database at this stage.
export interface ParsedStream {
  name: string
  kind: StreamKind
  category: string
}

// What the frontend sends to /api/onboarding/confirm.
// The user may have renamed, deleted, or reordered streams from the parsed list.
export interface ConfirmableStream {
  name: string
  kind: StreamKind
  category: string
}

// What /api/onboarding/confirm returns for each saved stream.
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
