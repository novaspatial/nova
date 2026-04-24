import { Container } from '@/components/layout/Container'
import { ProtectedRootLayout } from '@/components/layout/ProtectedRootLayout'
import { AudioProvider } from '@/components/audio/AudioProvider'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
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
        <Container className="mt-14 sm:mt-16 lg:mt-40 pb-6">
          {children}
        </Container>
        <AudioPlayer />
      </AudioProvider>
    </ProtectedRootLayout>
  )
}
