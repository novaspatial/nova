import { Container } from '@/components/Container'
import { RootLayout } from '@/components/RootLayout'
import { AudioProvider } from '@/components/audio/AudioProvider'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { createClient } from '@/lib/supabase/supabaseServer'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Client Portal',
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  if (!supabase) {
    redirect('/login')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <RootLayout>
      <AudioProvider>
        <Container className="mt-36 sm:mt-44 lg:mt-48 pb-20 sm:pb-32">
          {children}
        </Container>
        <AudioPlayer />
      </AudioProvider>
    </RootLayout>
  )
}
