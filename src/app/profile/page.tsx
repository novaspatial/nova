import { Container } from '@/components/layout/Container'
import { requirePageProfile } from '@/lib/auth/server'
import { ProfileForm } from './ProfileForm'

export const metadata = {
  title: 'Profile',
}

export default async function ProfilePage() {
  const { user, profile } = await requirePageProfile()

  const profileForForm = profile
    ? {
        id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      }
    : null

  return (
    <Container className="mt-36 sm:mt-44 lg:mt-48">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Your Profile
        </h1>
        <p className="mt-4 text-base text-zinc-400">
          Manage your account information.
        </p>

        <div className="mt-8 sm:mt-10 rounded-2xl border border-white/10 bg-white/2 p-4 sm:p-8 shadow-2xl shadow-violet-500/5 backdrop-blur-sm">
          <div className="mb-6 sm:mb-8 flex items-center gap-4 sm:gap-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-violet-500/30 bg-violet-500/10 sm:h-20 sm:w-20">
              <span className="text-lg font-bold text-violet-400 sm:text-2xl">
                {(
                  profile?.display_name?.[0] ||
                  user.email?.[0] ||
                  '?'
                ).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-white sm:text-xl">
                {profile?.display_name || 'Anonymous'}
              </h2>
              <p className="truncate text-sm text-zinc-400">{user.email}</p>
            </div>
          </div>

          <ProfileForm profile={profileForForm} />
        </div>
      </div>
    </Container>
  )
}
