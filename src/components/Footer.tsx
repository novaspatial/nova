import Link from 'next/link'

import { Container } from '@/components/Container'
import { FadeIn } from '@/components/FadeIn'
import { Logo } from '@/components/Logo'
import { socialMediaProfiles } from '@/components/SocialMedia'

const navigation = [
  {
    title: 'Company',
    links: [
      { title: 'About', href: '/about' },
      { title: 'Blog', href: '/blog' },
      { title: 'Contact us', href: '/contact' },
    ],
  },
  {
    title: 'Connect',
    links: socialMediaProfiles,
  },
]

function Navigation() {
  return (
    <nav>
      <ul role="list" className="grid grid-cols-2 gap-4 sm:gap-8">
        {navigation.map((section, sectionIndex) => (
          <li key={sectionIndex}>
            <div className="font-display text-[10px] sm:text-sm 3xl:text-base font-semibold tracking-wider text-white">
              {section.title}
            </div>
            <ul role="list" className="mt-2 sm:mt-4 text-[10px] sm:text-sm 3xl:text-base text-white/70">
              {section.links.map((link, linkIndex) => (
                <li key={linkIndex} className="mt-2 sm:mt-4">
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
    <form className="max-w-sm 3xl:max-w-md">
      <h2 className="font-display text-[10px] sm:text-sm 3xl:text-base font-semibold tracking-wider text-white">
        Sign up for our newsletter
      </h2>
      <p className="mt-2 sm:mt-4 text-[10px] sm:text-sm 3xl:text-base text-white/70">
        Subscribe to get the latest design news, articles, resources and
        inspiration.
      </p>
      <div className="relative mt-3 sm:mt-6">
        <input
          type="email"
          placeholder="Email address"
          autoComplete="email"
          aria-label="Email address"
          className="block w-full rounded-xl sm:rounded-2xl border border-white/20 bg-transparent py-2 sm:py-4 3xl:py-5 pr-12 sm:pr-20 pl-3 sm:pl-6 3xl:pl-8 text-[10px] sm:text-base/6 3xl:text-lg text-white ring-4 ring-transparent transition placeholder:text-white/50 focus:border-violet-400 focus:ring-violet-500/10 focus:outline-hidden"
        />
        <div className="absolute inset-y-0.5 sm:inset-y-1 right-0.5 sm:right-1 flex justify-end">
          <button
            type="submit"
            aria-label="Submit"
            className="flex aspect-square h-full items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-r from-indigo-900 via-violet-800 to-purple-900 text-white transition hover:from-indigo-950 hover:via-violet-900 hover:to-purple-950"
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
    <Container as="footer" className="mt-10 w-full sm:mt-24 lg:mt-40">
      <FadeIn>
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:gap-y-16 lg:grid-cols-2">
          <Navigation />
          <div className="flex lg:justify-end">
            <NewsletterForm />
          </div>
        </div>
        <div className="mt-10 sm:mt-24 mb-8 sm:mb-20 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-t border-violet-500/20 pt-6 sm:pt-12">
          <Link href="/" aria-label="Home">
            <Logo className="h-5 sm:h-8 3xl:h-10" fillOnHover />
          </Link>
          <p className="text-[10px] sm:text-sm 3xl:text-base text-white/70">
            © Studio Agency Inc. {new Date().getFullYear()}
          </p>
        </div>
      </FadeIn>
    </Container>
  )
}
