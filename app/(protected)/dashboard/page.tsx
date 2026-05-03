import { auth, signOut } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { DashboardShell } from './components/DashboardShell'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id

  const [streams, transactions, aiActions] = await Promise.all([
    prisma.incomeStream.findMany({
      where: { userId, isActive: true },
      include: { virtualAccount: { select: { accountNumber: true, bankName: true } } },
      orderBy: { createdAt: 'asc' },
    }),

    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { incomeStream: { select: { name: true } } },
    }),

    prisma.aIAction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ])

  return (
    <div>
      {/* Sign-out form lives outside the client shell so it works without JS */}
      <div className="fixed right-4 top-4 z-10">
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <button
            type="submit"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 shadow-sm transition-colors hover:border-zinc-400 hover:text-zinc-900"
          >
            Sign out
          </button>
        </form>
      </div>

      <DashboardShell
        userName={session.user.name ?? 'there'}
        streams={streams.map((s) => ({
          id: s.id,
          name: s.name,
          kind: s.kind,
          virtualAccount: s.virtualAccount
            ? { accountNumber: s.virtualAccount.accountNumber, bankName: s.virtualAccount.bankName }
            : null,
        }))}
        initialTransactions={transactions.map((tx) => ({
          id: tx.id,
          amount: Number(tx.amount),
          currency: tx.currency,
          description: tx.description,
          streamName: tx.incomeStream?.name ?? 'Unknown stream',
          categoryLabel: tx.categoryLabel,
          aiReasoning: tx.aiReasoning,
          createdAt: tx.createdAt.toISOString(),
        }))}
        initialFeed={aiActions.map((a) => ({
          id: a.id,
          prompt: a.prompt,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
