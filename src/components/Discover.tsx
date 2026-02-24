import { Section } from '@/components/Section'
import { TagList, TagListItem } from '@/components/TagList'
import nova from '@/images/nova.png'
import Link from 'next/link'

export function Discover() {
  return (
    <Section
      title="World-Class Dolby Atmos Certified Mixing Facility"
      image={{ src: nova }}
    >
      <div className="space-y-3 text-xs text-neutral-300 sm:space-y-6 sm:text-base 3xl:space-y-8 3xl:text-lg">
        <p>
          Nova Spatial operates out of a premier, purpose-built mix studio. Our
          flagship mix room was custom-designed by renowned studio architect
          J.H. Brandt, ensuring absolute critical listening accuracy and a
          perfectly controlled immersive soundstage. Our award-winning engineers
          leverage this environment to deliver unparalleled results across Pop,
          Rap, EDM, Rock, Country, and Orchestral projects.
        </p>
        <p>
          Our facility is officially Dolby Atmos Certified and features a
          top-tier monitoring array powered by flagship ATC SCM100 speakers.
          This elite hardware, coupled with high-end conversion, the best in
          modern processing and select classic analog equipment allows our
          engineers to create the amazing sounding spatial audio mixes that are
          true to your vision and translate in all environments.
        </p>
        <p>
          When you book with us, you are getting the acoustic perfection of a
          best-in-class studio paired with the convenience of a remote workflow.
          Our easy system streamlines your project with secure file uploads, an
          interactive online listening portal with Binaural or Atmos playback,
          and simple downloading of your final Apple Music and Tidal compliant
          files.
        </p>
      </div>

      <h3 className="mt-8 font-display text-sm font-semibold text-white sm:mt-12 sm:text-base 3xl:mt-16 3xl:text-lg">
        <Link
          href="/contact"
          className="inline-block bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent underline decoration-violet-400/0 underline-offset-4 transition-all duration-300 hover:scale-105 hover:from-indigo-200 hover:via-violet-200 hover:to-purple-200 hover:decoration-violet-400"
        >
          Book Your Atmos Mix !
        </Link>
      </h3>
      <TagList className="mt-3 sm:mt-4">
        <TagListItem>Dolby Atmos Certified Facility</TagListItem>
        <TagListItem>Spatial Tone Lock Translation</TagListItem>
        <TagListItem>Flagship ATC Monitoring</TagListItem>
        <TagListItem>High-End Conversion</TagListItem>
        <TagListItem>Award-Winning Engineers</TagListItem>
        <TagListItem>Secure Remote Mix Platform</TagListItem>
      </TagList>
    </Section>
  )
}
