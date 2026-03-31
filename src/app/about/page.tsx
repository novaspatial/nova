import { type Metadata } from 'next'
import Link from 'next/link'

import { Border } from '@/components/ui/Border'
import { ContactForm } from '@/components/sections/ContactForm'
import { Container } from '@/components/layout/Container'
import { FadeIn, FadeInStagger } from '@/components/ui/FadeIn'
import { Offices } from '@/components/sections/Offices'
import { PageIntro } from '@/components/ui/PageIntro'

import { StatList, StatListItem } from '@/components/ui/StatList'
import imageBlakeReid from '@/images/team/blake-reid.jpg'
import imageChelseaHagon from '@/images/team/chelsea-hagon.jpg'
import imageEmmaDorsey from '@/images/team/emma-dorsey.jpg'
import imageKathrynMurphy from '@/images/team/kathryn-murphy.jpg'
import imageLeonardKrasner from '@/images/team/leonard-krasner.jpg'
import imageWhitneyFrancis from '@/images/team/whitney-francis.jpg'
import { RootLayout } from '@/components/layout/RootLayout'
import { PersonCard } from '@/components/ui/PersonCard'

const team = [
  {
    title: 'Team',
    people: [
      {
        name: 'Chelsea Hagon',
        role: 'Senior Developer',
        image: { src: imageChelseaHagon },
        bio: 'Chelsea has been shaping our engineering culture for over a decade. She leads architecture decisions and mentors junior developers, with a passion for clean, maintainable systems.',
      },
      {
        name: 'Emma Dorsey',
        role: 'Senior Designer',
        image: { src: imageEmmaDorsey },
        bio: 'Emma brings a rare blend of visual artistry and spatial intuition to every project. Her design language defines the NovaSpatial aesthetic — minimal, immersive, and purposeful.',
      },
      {
        name: 'Leonard Krasner',
        role: 'VP, User Experience',
        image: { src: imageLeonardKrasner },
        bio: 'Leonard has spent 20 years obsessing over how people interact with sound. He leads our UX strategy, ensuring every touchpoint feels as natural as the music itself.',
      },
      {
        name: 'Blake Reid',
        role: 'Junior Copywriter',
        image: { src: imageBlakeReid },
        bio: 'Blake crafts the words that carry our brand voice. With a background in music journalism, he brings authentic storytelling to everything from campaign copy to liner notes.',
      },
      {
        name: 'Kathryn Murphy',
        role: 'VP, Human Resources',
        image: { src: imageKathrynMurphy },
        bio: 'Kathryn builds the team behind the sound. She champions a culture of excellence and inclusion, making sure NovaSpatial remains a place where world-class talent thrives.',
      },
      {
        name: 'Whitney Francis',
        role: 'Content Specialist',
        image: { src: imageWhitneyFrancis },
        bio: 'Whitney shapes how the world understands spatial audio. Her editorial strategy spans long-form features, social content, and educational resources that put our work in context.',
      },
    ],
  },
]

function ContactSection() {
  return (
    <Container className="mt-24 sm:mt-32 lg:mt-40">
      <FadeIn>
        <h2 className="font-display text-base font-semibold text-white">
          Contact us
        </h2>
        <p className="mt-6 font-display text-5xl font-medium tracking-tight text-white text-balance sm:text-6xl">
          Let&apos;s work together.
        </p>
        <p className="mt-6 text-xl text-zinc-300">
          Ready to elevate your music to the next dimension? <br/> Reach out to our team and let&apos;s craft a spatial audio experience that moves your audience.
        </p>
      </FadeIn>
      <Border className="mt-16" />
      <div className="grid grid-cols-1 gap-x-8 gap-y-24 pt-16 lg:grid-cols-2">
        <ContactForm />

        <FadeIn>
          <h2 className="font-display text-base font-semibold text-white">
            Our offices
          </h2>
          <Offices className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2" />

          <Border className="mt-16 pt-16">
            <h2 className="font-display text-base font-semibold text-white">
              Email us
            </h2>
            <dl className="mt-6 grid grid-cols-1 gap-8 text-sm sm:grid-cols-2">
              {[['Contact', 'mix@nova-spatial.com']].map(([label, email]) => (
                <div key={email}>
                  <dt className="font-semibold text-white">{label}</dt>
                  <dd>
                    <Link
                      href={`mailto:${email}`}
                      className="text-white hover:text-violet-300"
                    >
                      {email}
                    </Link>
                  </dd>
                </div>
              ))}
            </dl>
          </Border>
        </FadeIn>
      </div>
    </Container>
  )
}

function Team() {
  return (
    <Container className="mt-24 sm:mt-32 lg:mt-40">
      <div className="space-y-24">
        {team.map((group) => (
          <FadeInStagger key={group.title}>
            <Border as={FadeIn} />
            <div className="grid grid-cols-1 gap-6 pt-12 sm:pt-16 lg:grid-cols-4 xl:gap-8">
              <FadeIn>
                <h2 className="font-display text-2xl font-semibold text-white">
                  {group.title}
                </h2>
              </FadeIn>
              <div className="lg:col-span-3">
                <ul
                  role="list"
                  className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8"
                >
                  {group.people.map((person) => (
                    <li key={person.name}>
                      <FadeIn>
                        <PersonCard {...person} />
                      </FadeIn>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </FadeInStagger>
        ))}
      </div>
    </Container>
  )
}

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'We believe that our strength lies in our collaborative approach, which puts our clients at the center of everything we do.',
}

export default function About() {

  return (
    <RootLayout>
      <PageIntro eyebrow="About us" title="Elite Engineers. Uncompromised Spatial Audio.">
        <p>
        NovaSpatial was founded on a singular vision: to bring world-class, uncompromised immersive audio to artists and labels worldwide. Our award-winning team represents a diverse, top-tier range of expertise across the entire spectrum of modern music mixing and spatial audio formatting.
        </p>
        <div className="mt-10 max-w-2xl space-y-6 text-base">
          <p>
          With decades of industry experience, our engineers have been at the helm of records that have amassed billions of streams globally. We have spent our careers perfecting the art of sonic translation, ensuring that the raw energy and emotional impact of a record is never lost—whether it is a pristine stereo master or a fully immersive Dolby Atmos experience.
          </p>
          <p>
          Beyond the technical precision of our proprietary Spatial Tone Lock process, our true strength lies in our relentless dedication to client satisfaction. We treat every single project with the utmost care, prioritizing seamless communication, remote accessibility, and meticulous attention to detail to ensure your sonic vision is perfectly realized.
          </p>
        </div>
      </PageIntro>
      <Container className="mt-16">
        <StatList>
          <StatListItem value="20+" label="Years of Experience" />
          <StatListItem value="1B+" label="Global Streams" />
          <StatListItem value="10,000+" label="Projects Completed" />
        </StatList>
      </Container>

      <Team />

      <ContactSection />
    </RootLayout>
  )
}
