import { Container } from '@/components/layout/Container'
import { ProtectedRootLayout } from '@/components/layout/ProtectedRootLayout'
import { AudioProvider } from '@/components/audio/AudioProvider'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { PortalToastProvider } from '@/components/portal'
import { requirePageUser } from '@/lib/auth/server'

export const metadata = {
  title: 'Client Portal',
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePageUser()

  return (
    <ProtectedRootLayout hideFooter>
      <AudioProvider>
        {/* Above the status-keyed project subtree so a transition toast
            outlives the remount its own transition triggers. */}
        <PortalToastProvider>
          <Container className="mt-14 sm:mt-16 lg:mt-40 pb-6">
            {children}
          </Container>
        </PortalToastProvider>
        <AudioPlayer />
      </AudioProvider>
    </ProtectedRootLayout>
  )
}
