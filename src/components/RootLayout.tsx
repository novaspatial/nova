'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Popover,
  PopoverButton,
  PopoverBackdrop,
  PopoverPanel,
  Menu,
  MenuButton,
  MenuItems,
  MenuItem,
} from '@headlessui/react'
import clsx from 'clsx'
import type { User } from '@supabase/supabase-js'

import { Container } from '@/components/Container'
import { Footer } from '@/components/Footer'
import { GridPattern } from '@/components/GridPattern'
import { Logo, Logomark } from '@/components/Logo'
import { VideoBackground } from '@/components/VideoBackground'
import { createClient } from '@/lib/supabase/client'

const navLinks = [
  { href: '/about', label: 'About Us', highlight: false },
  { href: '/contact', label: 'Start Your Project!', highlight: true },
  { href: '/blog', label: 'Blog', highlight: false },
]

function CloseIcon(props: React.ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="m17.25 6.75-10.5 10.5M6.75 6.75l10.5 10.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronDownIcon(props: React.ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 8 6" aria-hidden="true" {...props}>
      <path
        d="M1.75 1.75 4 4.25l2.25-2.5"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MobileNavItem({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <li>
      <PopoverButton as={Link} href={href} className="block py-2">
        {children}
      </PopoverButton>
    </li>
  )
}

function MobileNavigation(
  props: React.ComponentPropsWithoutRef<typeof Popover>,
) {
  return (
    <Popover {...props}>
      <PopoverButton className="group flex items-center rounded-full bg-zinc-800/90 px-5 py-2.5 text-base font-medium text-zinc-200 shadow-lg ring-1 shadow-zinc-800/5 ring-white/10 backdrop-blur-sm hover:ring-white/20">
        Menu
        <ChevronDownIcon className="ml-3 h-auto w-2 stroke-zinc-400 group-hover:stroke-zinc-300" />
      </PopoverButton>
      <PopoverBackdrop
        transition
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs duration-150 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in"
      />
      <PopoverPanel
        focus
        transition
        className="fixed inset-x-4 top-8 z-50 origin-top rounded-3xl bg-zinc-900 p-8 ring-1 ring-zinc-800 duration-150 data-closed:scale-95 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in"
      >
        <div className="flex flex-row-reverse items-center justify-between">
          <PopoverButton aria-label="Close menu" className="-m-1 p-1">
            <CloseIcon className="h-6 w-6 text-zinc-400" />
          </PopoverButton>
          <h2 className="text-sm font-medium text-zinc-400">Navigation</h2>
        </div>
        <nav className="mt-6">
          <ul className="-my-2 divide-y divide-zinc-100/5 text-base text-zinc-300">
            {navLinks.map(({ href, label }) => (
              <MobileNavItem key={href} href={href}>
                {label}
              </MobileNavItem>
            ))}
          </ul>
        </nav>
      </PopoverPanel>
    </Popover>
  )
}

function NavItem({
  href,
  children,
  highlight = false,
}: {
  href: string
  children: React.ReactNode
  highlight?: boolean
}) {
  let isActive = usePathname() === href

  return (
    <li>
      <Link
        href={href}
        className={clsx(
          'relative block px-4 py-2.5 transition-all duration-300',
          highlight
            ? 'animate-nav-highlight text-white font-semibold hover:scale-110 hover:drop-shadow-[0_0_18px_rgba(139,92,246,0.8)]'
            : isActive
              ? 'text-violet-400'
              : 'hover:text-violet-400',
        )}
      >
        {children}
        {isActive && !highlight && (
          <span className="absolute inset-x-1 -bottom-px h-px bg-linear-to-r from-violet-400/0 via-violet-400/40 to-violet-400/0" />
        )}
      </Link>
    </li>
  )
}

function DesktopNavigation(props: React.ComponentPropsWithoutRef<'nav'>) {
  return (
    <nav {...props}>
      <div className="relative rounded-full p-px shadow-lg shadow-violet-500/10">
        <div
          className="absolute inset-0 rounded-full animate-border-flow"
          style={{
            background:
              'conic-gradient(from var(--border-angle, 0deg), transparent 60%, #a78bfa 78%, #c084fc 82%, #7c3aed 90%, transparent 100%)',
          }}
        />
        <ul className="relative flex rounded-full bg-zinc-800/90 px-4 text-base font-medium text-zinc-200 backdrop-blur-sm">
          {navLinks.map(({ href, label, highlight }) => (
            <NavItem key={href} href={href} highlight={highlight}>
              {label}
            </NavItem>
          ))}
        </ul>
      </div>
    </nav>
  )
}

function UserMenu() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return <div className="h-9 w-20" />
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-base font-medium text-zinc-200 ring-1 ring-white/10 backdrop-blur-sm transition hover:bg-white/15 hover:text-white hover:ring-white/25"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-5.5-2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM10 12a5.99 5.99 0 0 0-4.793 2.39A6.483 6.483 0 0 0 10 16.5a6.483 6.483 0 0 0 4.793-2.11A5.99 5.99 0 0 0 10 12Z"
            clipRule="evenodd"
          />
        </svg>
        Log in
      </Link>
    )
  }

  const initial = (
    user.user_metadata?.full_name?.[0] ||
    user.email?.[0] ||
    '?'
  ).toUpperCase()

  const avatarUrl = user.user_metadata?.avatar_url

  return (
    <Menu as="div" className="pointer-events-auto relative">
      <MenuButton className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-200 ring-1 ring-white/10 backdrop-blur-sm transition hover:bg-white/15 hover:text-white hover:ring-white/25">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-6 w-6 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-300">
            {initial}
          </span>
        )}
        <span className="hidden sm:block max-w-30 truncate">
          {user.user_metadata?.full_name || user.email?.split('@')[0]}
        </span>
      </MenuButton>

      <MenuItems
        transition
        className="absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-xl border border-white/10 bg-zinc-900/95 p-1 shadow-xl shadow-black/20 backdrop-blur-sm transition data-closed:scale-95 data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
      >
        <MenuItem>
          <Link
            href="/profile"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 data-focus:bg-white/10 data-focus:text-white"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-5.5-2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM10 12a5.99 5.99 0 0 0-4.793 2.39A6.483 6.483 0 0 0 10 16.5a6.483 6.483 0 0 0 4.793-2.11A5.99 5.99 0 0 0 10 12Z"
                clipRule="evenodd"
              />
            </svg>
            Profile
          </Link>
        </MenuItem>
        <MenuItem>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 data-focus:bg-white/10 data-focus:text-white"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114l-1.048-.943h9.546A.75.75 0 0 0 19 10Z"
                clipRule="evenodd"
              />
            </svg>
            Sign out
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  )
}

function Navbar() {
  return (
    <header className="pointer-events-none fixed top-0 right-0 left-0 z-50 flex pt-6">
      <Container className="w-full">
        <div className="relative flex items-center gap-4">
          <div className="flex flex-1">
            <Link
              href="/"
              aria-label="Home"
              className="pointer-events-auto shrink-0 transition-all duration-300 ease-out hover:scale-105 hover:drop-shadow-[0_0_14px_rgba(139,92,246,0.5)]"
            >
              <Logomark className="h-12 sm:hidden" />
              <Logo className="hidden h-14 sm:block" />
            </Link>
          </div>
          <div className="flex justify-center">
            <MobileNavigation className="pointer-events-auto md:hidden" />
            <DesktopNavigation className="pointer-events-auto hidden md:block" />
          </div>
          <div className="flex flex-1 justify-end">
            <UserMenu />
          </div>
        </div>
      </Container>
    </header>
  )
}

function RootLayoutInner({ children, videoSrc }: { children: React.ReactNode; videoSrc?: string }) {
  return (
    <>
      <Navbar />

      {videoSrc && (
        <div className="bg-zinc-950">
          <VideoBackground src={videoSrc} />
        </div>
      )}

      <div className="relative flex flex-auto overflow-hidden bg-zinc-950">
        <div className="relative isolate flex w-full flex-col">
          <GridPattern
            className="absolute inset-x-0 -top-14 -z-10 h-[1000px] w-full mask-[linear-gradient(to_bottom_left,white_40%,transparent_50%)] fill-violet-500/5 stroke-purple-500/10"
            yOffset={-96}
            interactive
          />

          <main className="w-full flex-auto">{children}</main>

          <Footer />
        </div>
      </div>
    </>
  )
}

export function RootLayout({ children, videoSrc }: { children: React.ReactNode; videoSrc?: string }) {
  return <RootLayoutInner videoSrc={videoSrc}>{children}</RootLayoutInner>
}
