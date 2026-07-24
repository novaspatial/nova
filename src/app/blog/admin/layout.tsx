import { Container } from '@/components/layout/Container'
import { ProtectedRootLayout } from '@/components/layout/ProtectedRootLayout'
import { requirePageStudioUser } from '@/lib/auth/server'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePageStudioUser()

  return (
    <ProtectedRootLayout hideFooter>
      <Container className="mt-14 sm:mt-16 lg:mt-40 pb-6">
        <div className="mx-auto max-w-5xl">{children}</div>
      </Container>
    </ProtectedRootLayout>
  )
}
