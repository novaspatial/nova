import Link from 'next/link'

import { Container } from '@/components/layout/Container'
import { NewsletterForm } from '@/components/layout/NewsletterForm'
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
    ],
  },
  {
    title: 'Legal',
    links: [{ title: 'Terms', href: '/terms' }],
  },
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
