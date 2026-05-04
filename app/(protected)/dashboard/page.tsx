import type { Metadata } from 'next'
import { auth } from '@/auth'
import DashboardClient from './_client'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const session = await auth()
  const firstName = (session?.user?.name || '').split(' ').filter(Boolean)[0] || 'there'

  return <DashboardClient name={firstName} />
}
