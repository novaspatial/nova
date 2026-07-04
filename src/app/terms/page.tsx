import { type Metadata } from 'next'

import { Container } from '@/components/layout/Container'
import { RootLayout } from '@/components/layout/RootLayout'
import { Border } from '@/components/ui/Border'
import { FadeIn, FadeInStagger } from '@/components/ui/FadeIn'
import { PageIntro } from '@/components/ui/PageIntro'
import { TERMS_LAST_UPDATED } from '@/lib/legal/terms'

// First-draft terms — neutral, accurate clauses only. Pending final legal/Jamie
// review. Do NOT add refund/cancellation policy (D-refund open) or a Stem Prep
// Guide link (#32 unbuilt) here. Any material change to this copy MUST bump
// TERMS_VERSION in src/lib/legal/terms.ts so existing consent is re-collected.

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description:
    'The terms that govern ordering a Dolby Atmos mix from NOVA Spatial.',
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <FadeIn transition={{ duration: 0.75, ease: 'easeOut' }}>
      <Border className="mt-12 pt-12">
        <h2 className="font-display text-lg font-semibold text-white sm:text-xl">
          {title}
        </h2>
        <div className="mt-4 space-y-4 text-base/7 text-zinc-300 sm:text-lg/8">
          {children}
        </div>
      </Border>
    </FadeIn>
  )
}

export default function Terms() {
  return (
    <RootLayout>
      <PageIntro eyebrow="Legal" title="Terms & Conditions">
        <p>
          These terms govern your use of NOVA Spatial and the spatial-audio
          services you order through it. Please read them before placing an
          order.
        </p>
        <p className="text-sm text-zinc-500">Last updated: {TERMS_LAST_UPDATED}</p>
      </PageIntro>

      <Container className="mt-24 sm:mt-32 lg:mt-40">
        <FadeInStagger
          className="mx-auto max-w-2xl"
          transition={{ staggerChildren: 0.3 }}
        >
          <Section title="1. Agreement">
            <p>
              By placing an order, creating a project, or otherwise using NOVA
              Spatial, you agree to these Terms &amp; Conditions. If you do not
              agree, do not place an order.
            </p>
          </Section>

          <Section title="2. The service">
            <p>
              NOVA Spatial provides Dolby Atmos and spatial-audio mixing and
              mastering. You commission a mix, upload your source material,
              review the mixes we prepare, and download the deliverables. The
              specific format and scope of each order are those shown at
              checkout for that order.
            </p>
          </Section>

          <Section title="3. Your material and rights">
            <p>
              You are responsible for the stems, reference tracks, and other
              material you upload. By uploading, you confirm that you own or
              have the necessary rights to that material and to have it mixed
              and mastered, and that doing so does not infringe anyone else&rsquo;s
              rights.
            </p>
            <p>
              You grant NOVA Spatial a limited licence to store and process
              your material only as needed to deliver the service you ordered.
              You keep ownership of your material and of the final deliverables
              once your order is paid.
            </p>
          </Section>

          <Section title="4. Confidentiality">
            <p>
              We treat the material you upload as confidential and use it only
              to provide the service. We do not share it with third parties
              except as needed to operate NOVA Spatial (for example, our
              hosting and payment providers) or as required by law.
            </p>
          </Section>

          <Section title="5. Payment">
            <p>
              Prices are shown at checkout in the currency displayed there, and
              payment is processed by our payment provider. Your order proceeds
              once payment is complete.
            </p>
          </Section>

          <Section title="6. Service provided &ldquo;as is&rdquo;">
            <p>
              NOVA Spatial is provided on an &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo; basis. To the fullest extent permitted by law, we
              are not liable for indirect or consequential losses, and our total
              liability for any order is limited to the amount you paid for that
              order.
            </p>
          </Section>

          <Section title="7. Changes to these terms">
            <p>
              We may update these terms from time to time. The version in effect
              when you place an order is the version that applies to that order,
              and we record which version you agreed to at checkout.
            </p>
          </Section>
        </FadeInStagger>
      </Container>
    </RootLayout>
  )
}
