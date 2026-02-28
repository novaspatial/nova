import { Section } from '@/components/Section'
import composition from '@/images/composition.png'
import Link from 'next/link'

export function Build() {
  return (
    <Section title="Spatial Tone Lock" image={{ src: composition, shape: 1 }}>
      <div className="space-y-3 sm:space-y-6 3xl:space-y-8 text-xs sm:text-base 3xl:text-lg text-zinc-300">
        <p>
        Part of what makes Atmos Spatial Audio so incredible is the added dynamic range and spread that results from going from stereo to fully immersive. But without the right technical knowledge and tools, Spatial Audio mixes often sound flat and dull and lack the energy of the Stereo Master. That is why we developed Spatial Tone Lock - a specialized workflow that combines our engineers' highly trained ears with proprietary audio plugins and reference tools to guarantee your spatial mix hits just as hard as the original.
        </p>
        <p>
        We utilize exclusive techniques for multi-channel clipping, musical compression, and spatial limiting to maximize headroom and immersive depth without ever sacrificing the song’s original vibe. Furthermore, knowing how and where to spread a mix is vital; it requires musical intuition and deep technical knowledge of spatial formatting. Rather than simply panning audio to different speakers, we use the industry's finest immersive reverbs, multi-tap delays, and chorus effects to create a perfect, three-dimensional environment that elevates the music to an entirely new level.
        </p>
        <p>
        Because spatial audio formats like Apple Spatial handle rendering uniquely, ensuring flawless translation across all platforms is our final, crucial step. We rigorously double-check your project using advanced emulators to replicate how the mix will behave across a wide variety of playback devices. Whether your fans are listening on a dedicated audiophile home Atmos system, a modern Atmos-equipped car, or walking down the street with AirPods, our comprehensive quality control ensures a spectacular, perfectly translated listening experience.
        </p>
      </div>

      <h3 className="mt-4 sm:mt-6 3xl:mt-8 font-display text-sm sm:text-base 3xl:text-lg font-semibold text-white">
      Experience Spatial Tone Lock - <Link href="/contact" className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent decoration-violet-400/0 underline underline-offset-4 transition-all duration-300 hover:from-indigo-200 hover:via-violet-200 hover:to-purple-200 hover:decoration-violet-400 hover:scale-105 inline-block">Start your Project Now !</Link>
      </h3>
    </Section>
  )
}
