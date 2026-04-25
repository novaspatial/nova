import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requirePageProfile } from '@/lib/auth/server'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = await requirePageProfile()
  if (profile?.role !== 'studio') {
    redirect('/portal')
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center gap-3 text-xs text-zinc-400">
        <Link href="/portal" className="hover:text-white">
          ← Portal
        </Link>
        <span className="text-zinc-600">/</span>
        <span>Admin</span>
      </div>
      {children}
    </div>
  )
}
