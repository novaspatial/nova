import { RootLayout } from '@/components/layout/RootLayout'

export function ProtectedRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RootLayout authAwareNavbar>{children}</RootLayout>
}
