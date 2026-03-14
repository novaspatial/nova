import { ProtectedRootLayout } from '@/components/layout/ProtectedRootLayout'
import { requirePageUser } from '@/lib/auth/server'

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePageUser()

  return <ProtectedRootLayout>{children}</ProtectedRootLayout>
}
