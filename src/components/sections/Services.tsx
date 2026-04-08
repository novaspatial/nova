import { Section } from '@/components/layout/Section'
import { TagList, TagListItem } from '@/components/ui/TagList'
import nova from '@/images/nova.jpg'
import composition from '@/images/composition.png'
import awards from '@/images/awards.png'
import { Button } from '@/components/ui/Button'

export function Services() {
  return (
    <div className="mt-6 space-y-24 [counter-reset:section] sm:mt-8 sm:space-y-32 lg:mt-10 lg:space-y-40">
      <Section id="spatial-tone-lock" title="Spatial Tone Lock" image={{ src: composition, shape: 1 }} plainImage>
        <div className="space-y-3 sm:space-y-6 3xl:space-y-8 text-xs sm:text-base 3xl:text-lg text-zinc-300">
          <p>
            <strong>Your stereo master is a carefully crafted piece of art — every limiter smash, every clipping decision, every sonic quirk is intentional. But when it comes to Spatial Audio, most engineers don&apos;t apply that same obsessive attention to detail. The result? A wider mix that somehow feels smaller.</strong>
          </p>
          <p>
            <strong>Our solution: Spatial Tone Lock.</strong> NOVA&apos;s proprietary workflow combines highly trained engineers with exclusive plugins and reference tools, engineered to guarantee your spatial mix hits just as hard as the original.
          </p>
          <p>
            <strong>Platform-perfect translation.</strong> Every streaming platform renders Spatial Audio differently. Spatial Tone Lock ensures flawless playback across all of them.
          </p>
          <p>
            <strong>The technical edge.</strong> Multi-channel limiting, musical compression, and precision EQ matching maximize headroom and immersive depth without losing the original vibe.
          </p>
          <p>
            <strong>Depth that feels real.</strong> Rather than simply panning audio to different speakers, we use industry-leading immersive reverbs, multi-tap delays, and chorus effects to build a true three-dimensional environment around your music.
          </p>
        </div>

        <h3 className="mt-2 flex items-center gap-x-2 sm:gap-x-4 sm:mt-6 3xl:mt-8 font-display text-[0.625rem] sm:text-base 3xl:text-lg font-semibold text-white">
          Experience Spatial Tone Lock  - <Button href="/about" className="!py-0.5 sm:!py-1">Start Project Now !</Button>
        </h3>
      </Section>

      <Section
        title="Dolby Atmos Certified Mixing Facility"
        image={{ src: nova }}
        plainImage
      >
        <div className="space-y-3 text-xs text-zinc-300 sm:space-y-6 sm:text-base 3xl:space-y-8 3xl:text-lg">
          <p>
            NOVA Spatial is a world-class Dolby Atmos certified studio, built from the ground up for one purpose: getting spatial audio right. A flagship ATC SCM100 monitoring array, high-end conversion, the best in modern processing, and select classic analog equipment give our award-winning engineers the critical listening environment to deliver unparalleled results across Pop, Rap, EDM, Rock, Country, and Orchestral projects.
          </p>
          <p>
            <strong>Exceptional results. Seamless remote workflow.</strong> Our custom client portal makes file submission, mix feedback, and final approval simple from start to finish.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Secure file uploads</strong> — fast, private, and simple</li>
            <li><strong>Atmos &amp; Binaural playback</strong> — hear your mix exactly as intended, in any format</li>
            <li><strong>Apple Music &amp; Tidal compliant delivery</strong> — final files ready to distribute</li>
          </ul>
          <p>
            <strong>No Atmos system? No problem.</strong> Our client portal lets you preview your spatial mix in binaural playback — exactly how listeners on headphones and stereo setups will hear it. Review, approve, and sign off with confidence. No special hardware required.
          </p>
        </div>
          <h3 className="mt-2 font-display text-[0.625rem] font-semibold text-white sm:mt-3 sm:text-base 3xl:mt-4 3xl:text-lg">
          Claim your spot today - <Button href="/about" className="!py-0.5 sm:!py-1">Book Your Atmos Mix !</Button>
        </h3>
      </Section>

      <Section title="The Atmos Advantage" image={{ src: awards, shape: 2 }} plainImage>
        <div className="space-y-3 sm:space-y-6 3xl:space-y-8 text-xs sm:text-base 3xl:text-lg text-zinc-300">
          <p>
            <strong>Sound bigger.</strong> Three-dimensional audio. Unprecedented depth and dynamic range.
          </p>
          <p>
            <strong>Get discovered faster.</strong> Apple Music&apos;s algorithm actively favors Atmos-enabled tracks — better placement, more reach.
          </p>
          <p>
            <strong>Earn more per stream.</strong> Apple pays higher royalty rates for Spatial Audio releases.
          </p>
        </div>
      </Section>
    </div>
  )
}
