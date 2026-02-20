import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RootLayout } from '@/components/RootLayout'
import { Container } from '@/components/Container'
import { ProfileForm } from './profile-form'

export const metadata = {
  title: 'Profile',
}

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <RootLayout>
      <Container className="mt-36 sm:mt-44 lg:mt-48">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Your Profile
          </h1>
          <p className="mt-4 text-base text-zinc-400">
            Manage your account information.
          </p>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/2 p-8 shadow-2xl shadow-violet-500/5 backdrop-blur-sm">
            <div className="mb-8 flex items-center gap-6">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="h-20 w-20 rounded-full border-2 border-violet-500/30 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-violet-500/30 bg-violet-500/10">
                  <span className="text-2xl font-bold text-violet-400">
                    {(
                      profile?.display_name?.[0] ||
                      user.email?.[0] ||
                      '?'
                    ).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {profile?.display_name || 'Anonymous'}
                </h2>
                <p className="text-sm text-zinc-400">{user.email}</p>
              </div>
            </div>

            <ProfileForm profile={profile} />
          </div>
        </div>
      </Container>
    </RootLayout>
  )
}
