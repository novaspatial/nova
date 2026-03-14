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
        <Container className="mt-56 sm:mt-64 lg:mt-72 pb-20 sm:pb-32">
          {children}
        </Container>
        <AudioPlayer />
      </AudioProvider>
    </ProtectedRootLayout>
  )
}
