import Link from 'next/link'

import { FadeIn } from '@/components/ui/FadeIn'
import { requirePageProfile } from '@/lib/auth/server'
import { DiscountCodesAdmin } from '@/components/admin/DiscountCodesAdmin'
import type { DiscountCode } from '@/types/portal'

// Studio-only: gated by the blog/admin layout (redirects non-studio to
// /portal); RLS on discount_codes is the enforcement floor underneath.
export default async function AdminDiscountCodes() {
  const { supabase } = await requirePageProfile()

  const { data } = await supabase
    .from('discount_codes')
    .select('*')
    .order('created_at', { ascending: false })

  const codes = (data ?? []) as DiscountCode[]

  return (
    <div>
      <FadeIn>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Discount codes
          </h1>
          <Link
            href="/blog/admin/blog"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
          >
            ← Admin
          </Link>
        </div>
      </FadeIn>

      <div className="mt-8">
        <FadeIn>
          <DiscountCodesAdmin initialCodes={codes} />
        </FadeIn>
      </div>
    </div>
  )
}
