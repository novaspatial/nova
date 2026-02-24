import { List, ListItem } from '@/components/List'
import { Section } from '@/components/Section'
import mix from '@/images/mix.png'

export function Deliver() {
  return (
    <Section
      title="Seamless Remote Collaboration"
      image={{ src: mix, shape: 2 }}>
      <div className="space-y-3 text-xs text-neutral-300 sm:space-y-6 sm:text-base 3xl:space-y-8 3xl:text-lg">
        <p>
          Our streamlined workflow makes world-class spatial mixing effortless,
          no matter where you are in the world.
        </p>
      </div>
      <List className="mt-6 sm:mt-8">
        <ListItem title="Step 1: Secure Upload">
          Securely transfer your multitrack stems and final Stereo Master
          reference to our dedicated project portal.
        </ListItem>
        <ListItem title="Step 2: Interactive Listening">
          Experience your new spatial mix through our secure online platform,
          featuring both high-fidelity Binaural and true Dolby Atmos playback
          options.
        </ListItem>
        <ListItem title="Step 3: Timestamped Revisions">
          Easily drop precise, timestamped mix notes and feedback directly on
          the track timeline to ensure every detail matches your vision
          perfectly.
        </ListItem>
        <ListItem title="Step 4: Platform-Ready Delivery">
          Download your approved, fully compliant ADM BWF master files — ready
          for immediate release on Apple Music, Tidal, Amazon Music, and all
          immersive streaming platforms.
        </ListItem>
      </List>
    </Section>
  )
}
