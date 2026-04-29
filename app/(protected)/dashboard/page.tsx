import { auth, signOut } from '@/auth'

export default async function DashboardPage() {
  const session = await auth()

  return (
    <div className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">Welcome back, {session?.user?.name}</p>
        </div>

        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <button
            type="submit"
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
