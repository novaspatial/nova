import { Section } from '@/components/Section'
import { TagList, TagListItem } from '@/components/TagList'
import nova from '@/images/nova.png'

export function Discover() {
  return (
    <Section title="World-Class Dolby Atmos Certified Mixing Facility" image={{ src: nova }}>
      <div className="space-y-3 sm:space-y-6 3xl:space-y-8 text-xs sm:text-base 3xl:text-lg text-neutral-300">
        <p>
        Nova Spatial operates out of a premier, purpose-built mix studio. Our flagship mix room was custom-designed by renowned studio architect J.H. Brandt, ensuring absolute critical listening accuracy and a perfectly controlled immersive soundstage. Our award-winning engineers leverage this environment to deliver unparalleled results across Pop, Rap, EDM, Rock, Country, and Orchestral projects.
        </p>
        <p>
        Our facility is officially Dolby Atmos Certified and features a top-tier monitoring array powered by flagship ATC SCM100 speakers. This elite hardware, coupled with high-end conversion, the best in modern processing and select classic analog equipment allows our engineers to create the amazing sounding spatial audio mixes that are true to your vision and translate in all environments. 
        </p>
        <p>
        When you book with us, you are getting the acoustic perfection of a best-in-class studio paired with the convenience of a remote workflow. Our easy system streamlines your project with secure file uploads, an interactive online listening portal with Binaural or Atmos playback, and simple downloading of your final Apple Music and Tidal compliant files. 
        </p>
      </div>

      <h3 className="mt-8 sm:mt-12 3xl:mt-16 font-display text-sm sm:text-base 3xl:text-lg font-semibold text-white">
      Book Your Atmos Mix
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
