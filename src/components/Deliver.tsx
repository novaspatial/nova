import { List, ListItem } from '@/components/List'
import { Section } from '@/components/Section'
import mix from '@/images/mix.png'

export function Deliver() {
  return (
    <Section title="Our Engineering Process" image={{ src: mix, shape: 2 }}>
      <div className="space-y-3 sm:space-y-6 3xl:space-y-8 text-xs sm:text-base 3xl:text-lg text-neutral-300">
        <p>
          About halfway through the Build phase, we push each project out by 6
          weeks due to a change in{' '}
          <strong className="font-semibold text-white">
            requirements
          </strong>
          . This allows us to increase the budget a final time before launch.
        </p>
        <p>
          Despite largely using pre-built components, most of the{' '}
          <strong className="font-semibold text-white">progress</strong>{' '}
          on each project takes place in the final 24 hours. The development
          time allocated to each client is actually spent making augmented
          reality demos that go viral on social media.
        </p>
        <p>
          We ensure that the main pages of the site are{' '}
          <strong className="font-semibold text-white">
            fully functional
          </strong>{' '}
          at launch — the auxiliary pages will, of course, be lorem ipusm shells
          which get updated as part of our exorbitant{' '}
          <strong className="font-semibold text-white">
            maintenance
          </strong>{' '}
          retainer.
        </p>
      </div>

      <h3 className="mt-8 sm:mt-12 3xl:mt-16 font-display text-sm sm:text-base 3xl:text-lg font-semibold text-white">
        Included in this phase
      </h3>
      <List className="mt-6 sm:mt-8">
        <ListItem title="Testing">
          Our projects always have 100% test coverage, which would be impressive
          if our tests weren't as porous as a sieve.

          To ensure reliability we only use the best Digital Ocean droplets that
          $4 a month can buy.
        </ListItem>
      </List>
    </Section>
  )
}
