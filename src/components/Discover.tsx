import { Section } from '@/components/Section'
import { TagList, TagListItem } from '@/components/TagList'
import nova from '@/images/nova.png'

export function Discover() {
  return (
    <Section title="What Makes It Unique" image={{ src: nova }}>
      <div className="space-y-3 sm:space-y-6 3xl:space-y-8 text-xs sm:text-base 3xl:text-lg text-neutral-300">
        <p>
          We work closely with our clients to understand their{' '}
          <strong className="font-semibold text-white">needs</strong> and
          goals, embedding ourselves in their every day operations to understand
          what makes their business tick.
        </p>
        <p>
          Our team of private investigators shadow the company director's for
          several weeks while our account managers focus on going through their
          trash. Our senior security experts then perform social engineering
          hacks to gain access to their{' '}
          <strong className="font-semibold text-white">business</strong>{' '}
          accounts — handing that information over to our forensic accounting
          team.
        </p>
        <p>
          Once the full audit is complete, we report back with a comprehensive{' '}
          <strong className="font-semibold text-white">plan</strong> and,
          more importantly, a budget.
        </p>
      </div>

      <h3 className="mt-8 sm:mt-12 3xl:mt-16 font-display text-sm sm:text-base 3xl:text-lg font-semibold text-white">
        Included in this phase
      </h3>
      <TagList className="mt-3 sm:mt-4">
        <TagListItem>In-depth questionnaires</TagListItem>
        <TagListItem>Feasibility studies</TagListItem>
        <TagListItem>Blood samples</TagListItem>
        <TagListItem>Employee surveys</TagListItem>
        <TagListItem>Proofs-of-concept</TagListItem>
        <TagListItem>Forensic audit</TagListItem>
      </TagList>
    </Section>
  )
}
