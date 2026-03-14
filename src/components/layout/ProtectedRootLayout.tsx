import { RootLayout } from '@/components/layout/RootLayout'

export function ProtectedRootLayout({
  children,
  hideFooter = false,
}: {
  children: React.ReactNode
  hideFooter?: boolean
}) {
  return (
    <RootLayout authAwareNavbar hideFooter={hideFooter}>
      {children}
    </RootLayout>
  )
}
