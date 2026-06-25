import Link from 'next/link'

import { Container } from '@/components/layout/Container'
import { FadeIn } from '@/components/ui/FadeIn'
import { Logo } from '@/components/ui/Logo'

type FooterNavLink = { title: string; href: string }
type FooterNavGroup = { title: string; links: FooterNavLink[] }

const navigation: FooterNavGroup[] = [
  {
    title: 'NovaSpatial',
    links: [
      { title: 'About', href: '/about' },
      { title: 'Blog', href: '/blog' },
      { title: 'Contact', href: '/about' },
    ],
  },
  // Legal group (Terms, Privacy, …) drops in here — see #23 (T&C).
]

function Navigation() {
  return (
    <nav>
      <ul role="list" className="grid grid-cols-2 gap-4 text-center sm:gap-8 lg:text-left">
        {navigation.map((section) => (
          <li key={section.title}>
            <div className="font-display text-[10px] font-semibold tracking-wider text-white sm:text-sm 3xl:text-base">
              {section.title}
            </div>
            <ul
              role="list"
              className="mt-2 text-[10px] text-white/70 sm:mt-4 sm:text-sm 3xl:text-base"
            >
              {section.links.map((link) => (
                <li key={link.title} className="mt-2 sm:mt-4">
                  <Link
                    href={link.href}
                    className="transition hover:text-white"
                  >
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function ArrowIcon(props: React.ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 16 6" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 3 10 .5v2H0v1h10v2L16 3Z"
      />
    </svg>
  )
}

function NewsletterForm() {
  return (
    <form className="max-w-102 text-center lg:text-left 3xl:max-w-118">
      <h2 className="font-display text-[10px] font-semibold tracking-wider text-white sm:text-sm 3xl:text-base">
        Subscribe
      </h2>
      <p className="mt-2 text-[10px] text-white/70 sm:mt-4 sm:text-sm 3xl:text-base">
        Get a 50% discount on your first Atmos mix.
      </p>
      <div className="relative mt-3 sm:mt-6">
        <input
          type="email"
          placeholder="Email address"
          autoComplete="email"
          aria-label="Email address"
          className="block w-full rounded-xl border border-white/20 bg-transparent py-2 pr-12 pl-3 text-[10px] text-white ring-4 ring-transparent transition placeholder:text-white/50 focus:border-violet-400 focus:ring-violet-500/10 focus:outline-hidden sm:rounded-2xl sm:py-4 sm:pr-20 sm:pl-6 sm:text-base/6 3xl:py-5 3xl:pl-8 3xl:text-lg"
        />
        <div className="absolute inset-y-0.5 right-0.5 flex justify-end sm:inset-y-1 sm:right-1">
          <button
            type="submit"
            aria-label="Submit"
            className="flex aspect-square h-full items-center justify-center rounded-lg bg-gradient-to-r from-indigo-900 via-violet-800 to-purple-900 text-white transition hover:from-indigo-950 hover:via-violet-900 hover:to-purple-950 sm:rounded-xl"
          >
            <ArrowIcon className="w-3 sm:w-4 3xl:w-5" />
          </button>
        </div>
      </div>
    </form>
  )
}

export function Footer() {
  return (
    <Container as="footer" className="mt-10 w-full sm:mt-24 lg:mt-16">
      <FadeIn>
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:gap-y-16 lg:grid-cols-2">
          <Navigation />
          <div className="flex justify-center lg:justify-end">
            <NewsletterForm />
          </div>
        </div>
        <div className="mt-4 mb-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 pt-2 sm:mt-10 sm:mb-20 sm:pt-4 lg:items-end lg:justify-between">
          <Link href="/" aria-label="Home">
            <Logo className="h-5 sm:h-8 3xl:h-10" fillOnHover />
          </Link>
          <p className="text-[10px] text-white/70 sm:text-sm 3xl:text-base">
            © {new Date().getFullYear()} NOVA Spatial / Collide Entertainment Inc.
          </p>
        </div>
      </FadeIn>
    </Container>
  )
}
