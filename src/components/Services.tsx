import { Section } from '@/components/Section'
import { TagList, TagListItem } from '@/components/TagList'
import nova from '@/images/nova.png'
import composition from '@/images/composition.png'
import { Button } from '@/components/Button'

export function Services() {
  return (
    <div className="mt-6 space-y-24 [counter-reset:section] sm:mt-8 sm:space-y-32 lg:mt-10 lg:space-y-40">
      <Section
        title="World-Class Dolby Atmos Certified Mixing Facility"
        image={{ src: nova }}
      >
        <div className="space-y-3 text-xs text-zinc-300 sm:space-y-6 sm:text-base 3xl:space-y-8 3xl:text-lg">
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


        <TagList className="mt-2 sm:mt-3">
          <TagListItem>Dolby Atmos Certified Facility</TagListItem>
          <TagListItem>Spatial Tone Lock Translation</TagListItem>
          <TagListItem>Flagship ATC Monitoring</TagListItem>
          <TagListItem>High-End Conversion</TagListItem>
          <TagListItem>Award-Winning Engineers</TagListItem>
          <TagListItem>Secure Remote Mix Platform</TagListItem>
        </TagList>
          <h3 className="mt-2 font-display text-xs font-semibold text-white sm:mt-3 sm:text-base 3xl:mt-4 3xl:text-lg">
          Claim your spot today - <Button href="/contact">Book Your Atmos Mix !</Button>
        </h3>
      </Section>

      <Section title="Spatial Tone Lock" image={{ src: composition, shape: 1 }}>
        <div className="space-y-3 sm:space-y-6 3xl:space-y-8 text-xs sm:text-base 3xl:text-lg text-zinc-300">
          <p>
            Part of what makes Atmos Spatial Audio so incredible is the added dynamic range and spread that results from going from stereo to fully immersive. But without the right technical knowledge and tools, Spatial Audio mixes often sound flat and dull and lack the energy of the Stereo Master. That is why we developed Spatial Tone Lock - a specialized workflow that combines our engineers&apos; highly trained ears with proprietary audio plugins and reference tools to guarantee your spatial mix hits just as hard as the original.
          </p>
          <p>
            We utilize exclusive techniques for multi-channel clipping, musical compression, and spatial limiting to maximize headroom and immersive depth without ever sacrificing the song&apos;s original vibe. Furthermore, knowing how and where to spread a mix is vital; it requires musical intuition and deep technical knowledge of spatial formatting. Rather than simply panning audio to different speakers, we use the industry&apos;s finest immersive reverbs, multi-tap delays, and chorus effects to create a perfect, three-dimensional environment that elevates the music to an entirely new level.
          </p>
          <p>
            Because spatial audio formats like Apple Spatial handle rendering uniquely, ensuring flawless translation across all platforms is our final, crucial step. We rigorously double-check your project using advanced emulators to replicate how the mix will behave across a wide variety of playback devices. Whether your fans are listening on a dedicated audiophile home Atmos system, a modern Atmos-equipped car, or walking down the street with AirPods, our comprehensive quality control ensures a spectacular, perfectly translated listening experience.
          </p>
        </div>

        <h3 className="mt-4 flex items-center gap-x-2 sm:gap-x-4 sm:mt-6 3xl:mt-8 font-display text-xs sm:text-base 3xl:text-lg font-semibold text-white">
          Experience Spatial Tone Lock  - <Button href="/contact">Start your Project Now !</Button>
        </h3>
      </Section>
    </div>
  )
}
