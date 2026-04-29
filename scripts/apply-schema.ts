/**
 * Applies the full Prisma schema to the Railway database using the raw pg client.
 * Use this when `prisma migrate dev` fails with P1001 (Rust engine connectivity issue).
 *
 * WARNING: drops all existing tables first. Dev-only — never run against production.
 *
 * Run with:
 *   pnpm tsx scripts/apply-schema.ts
 *
 * If tables already exist, pass --force to drop and recreate:
 *   pnpm tsx scripts/apply-schema.ts --force
 *
 * Then re-seed:
 *   pnpm tsx prisma/seed.ts
 */
import 'dotenv/config'
import { Client } from 'pg'

// ── Production safeguard ──────────────────────────────────────────────────────
// Belt-and-suspenders: check both NODE_ENV and the DATABASE_URL hostname so
// the script is safe even when NODE_ENV is not explicitly set.
if (process.env.NODE_ENV === 'production') {
  console.error('✖ Refusing to run in production (NODE_ENV=production).')
  process.exit(1)
}

const dbUrl = process.env.DATABASE_URL ?? ''
const productionIndicators = ['railway.app', 'supabase.co', 'neon.tech', 'render.com']
if (productionIndicators.some((host) => dbUrl.includes(host)) && !dbUrl.includes('localhost')) {
  // Allow Railway in dev — Railway is also used as the dev database.
  // Only block if NODE_ENV is explicitly production (handled above) or if
  // someone points at a clearly production URL without a dev flag.
  // Extra flag: APPLY_SCHEMA_ALLOW_REMOTE=yes to acknowledge the risk explicitly.
  if (process.env.APPLY_SCHEMA_ALLOW_REMOTE !== 'yes') {
    console.error(
      '✖ DATABASE_URL points to a remote host. If this is intentional (e.g. Railway dev),\n' +
        '  re-run with APPLY_SCHEMA_ALLOW_REMOTE=yes to confirm.'
    )
    process.exit(1)
  }
}

const force = process.argv.includes('--force')
const client = new Client({ connectionString: dbUrl })

async function tablesExist(): Promise<boolean> {
  const { rows } = await client.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('User', 'IncomeStream', 'VirtualAccount')
  `)
  return parseInt(rows[0].count, 10) > 0
}

async function main() {
  await client.connect()
  console.log('✔ Connected to database')

  // ── Idempotency check ────────────────────────────────────────────────────────
  // Bail out if the schema is already in place and --force was not passed.
  // This prevents accidental data loss on a re-run.
  if (await tablesExist()) {
    if (!force) {
      console.error(
        '✖ Schema already exists. Pass --force to drop and recreate:\n' +
          '  pnpm tsx scripts/apply-schema.ts --force'
      )
      process.exitCode = 1
      return
    }
    console.log('⚠  --force passed — existing schema will be dropped.')
  }

  // ── Drop everything in dependency order ──────────────────────────────────────
  console.log('▶ Dropping existing tables and types…')

  await client.query(`
    DROP TABLE IF EXISTS "WebhookInbox"   CASCADE;
    DROP TABLE IF EXISTS "AIAction"       CASCADE;
    DROP TABLE IF EXISTS "Proposal"       CASCADE;
    DROP TABLE IF EXISTS "Transaction"    CASCADE;
    DROP TABLE IF EXISTS "VirtualAccount" CASCADE;
    DROP TABLE IF EXISTS "IncomeStream"   CASCADE;
    DROP TABLE IF EXISTS "User"           CASCADE;
    DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;

    DROP TYPE IF EXISTS "WebhookProvider" CASCADE;
    DROP TYPE IF EXISTS "AIStatus"        CASCADE;
    DROP TYPE IF EXISTS "AIActionType"    CASCADE;
    DROP TYPE IF EXISTS "ProposalStatus"  CASCADE;
    DROP TYPE IF EXISTS "TxStatus"        CASCADE;
    DROP TYPE IF EXISTS "TransactionType" CASCADE;
  `)

  // ── Create enums ─────────────────────────────────────────────────────────────
  console.log('▶ Creating enums…')

  await client.query(`
    CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT', 'TRANSFER');
    CREATE TYPE "TxStatus"        AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');
    CREATE TYPE "ProposalStatus"  AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');
    CREATE TYPE "AIActionType"    AS ENUM ('GENERATE_PROPOSAL', 'ANALYZE_INCOME', 'SUGGEST_SAVINGS', 'FORECAST', 'SUMMARIZE');
    CREATE TYPE "AIStatus"        AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
    CREATE TYPE "WebhookProvider" AS ENUM ('SQUAD');
  `)

  // ── Create tables ─────────────────────────────────────────────────────────────
  console.log('▶ Creating tables…')

  await client.query(`
    CREATE TABLE "User" (
      "id"           TEXT         NOT NULL,
      "email"        TEXT         NOT NULL,
      "name"         TEXT         NOT NULL,
      "passwordHash" TEXT,
      "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"    TIMESTAMP(3) NOT NULL,
      CONSTRAINT "User_pkey" PRIMARY KEY ("id")
    );

    CREATE TABLE "IncomeStream" (
      "id"        TEXT         NOT NULL,
      "userId"    TEXT         NOT NULL,
      "name"      TEXT         NOT NULL,
      "kind"      TEXT         NOT NULL,
      "category"  TEXT,
      "type"      TEXT,
      "amount"    DECIMAL(65,30),
      "frequency" TEXT,
      "currency"  TEXT         NOT NULL DEFAULT 'NGN',
      "isActive"  BOOLEAN      NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "IncomeStream_pkey" PRIMARY KEY ("id")
    );

    CREATE TABLE "VirtualAccount" (
      "id"             TEXT           NOT NULL,
      "streamId"       TEXT           NOT NULL,
      "squadReference" TEXT           NOT NULL,
      "accountNumber"  TEXT           NOT NULL,
      "accountName"    TEXT           NOT NULL,
      "bankName"       TEXT           NOT NULL,
      "balance"        DECIMAL(65,30) NOT NULL DEFAULT 0,
      "currency"       TEXT           NOT NULL DEFAULT 'NGN',
      "createdAt"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"      TIMESTAMP(3)   NOT NULL,
      CONSTRAINT "VirtualAccount_pkey" PRIMARY KEY ("id")
    );

    CREATE TABLE "Transaction" (
      "id"               TEXT              NOT NULL,
      "userId"           TEXT              NOT NULL,
      "incomeStreamId"   TEXT,
      "virtualAccountId" TEXT,
      "type"             "TransactionType" NOT NULL,
      "amount"           DECIMAL(65,30)    NOT NULL,
      "currency"         TEXT              NOT NULL DEFAULT 'NGN',
      "description"      TEXT,
      "status"           "TxStatus"        NOT NULL DEFAULT 'PENDING',
      "metadata"         JSONB,
      "createdAt"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"        TIMESTAMP(3)      NOT NULL,
      CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
    );

    CREATE TABLE "Proposal" (
      "id"          TEXT             NOT NULL,
      "userId"      TEXT             NOT NULL,
      "title"       TEXT             NOT NULL,
      "description" TEXT             NOT NULL,
      "amount"      DECIMAL(65,30)   NOT NULL,
      "currency"    TEXT             NOT NULL DEFAULT 'NGN',
      "status"      "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
      "aiGenerated" BOOLEAN          NOT NULL DEFAULT false,
      "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   TIMESTAMP(3)     NOT NULL,
      CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
    );

    CREATE TABLE "AIAction" (
      "id"         TEXT           NOT NULL,
      "userId"     TEXT           NOT NULL,
      "proposalId" TEXT,
      "type"       "AIActionType" NOT NULL,
      "prompt"     TEXT           NOT NULL,
      "result"     JSONB,
      "status"     "AIStatus"     NOT NULL DEFAULT 'PENDING',
      "createdAt"  TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"  TIMESTAMP(3)   NOT NULL,
      CONSTRAINT "AIAction_pkey" PRIMARY KEY ("id")
    );

    CREATE TABLE "WebhookInbox" (
      "id"        TEXT              NOT NULL,
      "eventId"   TEXT              NOT NULL,
      "provider"  "WebhookProvider" NOT NULL,
      "payload"   JSONB             NOT NULL,
      "processed" BOOLEAN           NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WebhookInbox_pkey" PRIMARY KEY ("id")
    );
  `)

  // ── Unique indexes ────────────────────────────────────────────────────────────
  console.log('▶ Creating indexes…')

  await client.query(`
    CREATE UNIQUE INDEX "User_email_key"                    ON "User"("email");
    CREATE UNIQUE INDEX "VirtualAccount_streamId_key"       ON "VirtualAccount"("streamId");
    CREATE UNIQUE INDEX "VirtualAccount_squadReference_key" ON "VirtualAccount"("squadReference");
    CREATE UNIQUE INDEX "VirtualAccount_accountNumber_key"  ON "VirtualAccount"("accountNumber");
    CREATE UNIQUE INDEX "WebhookInbox_eventId_key"          ON "WebhookInbox"("eventId");
  `)

  // ── Foreign keys ──────────────────────────────────────────────────────────────
  console.log('▶ Adding foreign keys…')

  await client.query(`
    ALTER TABLE "IncomeStream"
      ADD CONSTRAINT "IncomeStream_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "VirtualAccount"
      ADD CONSTRAINT "VirtualAccount_streamId_fkey"
      FOREIGN KEY ("streamId") REFERENCES "IncomeStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "Transaction"
      ADD CONSTRAINT "Transaction_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "Transaction"
      ADD CONSTRAINT "Transaction_incomeStreamId_fkey"
      FOREIGN KEY ("incomeStreamId") REFERENCES "IncomeStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

    ALTER TABLE "Transaction"
      ADD CONSTRAINT "Transaction_virtualAccountId_fkey"
      FOREIGN KEY ("virtualAccountId") REFERENCES "VirtualAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

    ALTER TABLE "Proposal"
      ADD CONSTRAINT "Proposal_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "AIAction"
      ADD CONSTRAINT "AIAction_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "AIAction"
      ADD CONSTRAINT "AIAction_proposalId_fkey"
      FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  `)

  console.log('\n✔ Schema applied successfully')
  console.log('  Next: pnpm tsx prisma/seed.ts')
}

// Use process.exitCode instead of process.exit() so the finally block always
// runs and the pg client connection is cleanly closed on both success and failure.
main()
  .catch((err: Error) => {
    console.error('✖ Failed:', err.message)
    process.exitCode = 1
  })
  .finally(() => client.end())
