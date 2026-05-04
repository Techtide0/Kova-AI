import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const streams = await prisma.incomeStream.findMany({
    where: { userId, isActive: true },
    include: {
      virtualAccount: {
        select: { accountNumber: true, bankName: true, balance: true },
      },
      transactions: {
        where: { status: 'COMPLETED' },
        select: { type: true, amount: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const streamStats = streams.map((s) => {
    const txs = s.transactions
    const revenue = txs
      .filter((t) => t.type === 'CREDIT')
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const expenses = txs
      .filter((t) => t.type === 'DEBIT')
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const monthRevenue = txs
      .filter((t) => t.type === 'CREDIT' && t.createdAt >= monthStart)
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const monthExpenses = txs
      .filter((t) => t.type === 'DEBIT' && t.createdAt >= monthStart)
      .reduce((sum, t) => sum + Number(t.amount), 0)

    return {
      id: s.id,
      name: s.name,
      kind: s.kind,
      category: s.category,
      revenue,
      expenses,
      profit: revenue - expenses,
      monthRevenue,
      monthProfit: monthRevenue - monthExpenses,
      txCount: txs.length,
      balance: s.virtualAccount ? Number(s.virtualAccount.balance) : 0,
      virtualAccount: s.virtualAccount
        ? { accountNumber: s.virtualAccount.accountNumber, bankName: s.virtualAccount.bankName }
        : null,
    }
  })

  const totals = streamStats.reduce(
    (acc, s) => ({
      totalBalance: acc.totalBalance + s.balance,
      monthlyIncome: acc.monthlyIncome + s.monthRevenue,
      monthlyProfit: acc.monthlyProfit + s.monthProfit,
    }),
    { totalBalance: 0, monthlyIncome: 0, monthlyProfit: 0 }
  )

  return Response.json({
    totals: { ...totals, activeStreams: streams.length, currency: 'NGN' as const },
    streams: streamStats,
  })
}
