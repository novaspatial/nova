'use client'

import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from '@headlessui/react'
import { MinusSmallIcon, PlusSmallIcon } from '@heroicons/react/24/outline'

import { Container } from '@/components/Container'
import { FadeIn, FadeInStagger } from '@/components/FadeIn'

const faqs = [
  {
    question: 'What files do I need to send for a Dolby Atmos mix?',
    answer:
      'We require your consolidated stems (WAV, 24-bit or 32-bit float, 48kHz native preferred) and your final, approved Stereo Master. All stems must start at exactly the same timecode so they line up perfectly when dropped into our system.',
  },
  {
    question: 'Should my stems be "wet" (with effects) or "dry"?',
    answer:
      'We need \u201cwet\u201d stems. Because our goal is to perfectly translate your original vision using our Spatial Tone Lock\u2122 process, your stems should include all your EQ, compression, delays, and reverbs. When all your stems are played together at zero (unity gain), they should sound identical to your final stereo mix.',
  },
  {
    question: 'Do I need to have my song mixed in stereo first?',
    answer:
      'Yes. We highly recommend having a finished and approved stereo mix before moving to the Atmos stage. The stereo master acts as the blueprint for our engineers to match the punch, glue, and emotion of your record in the immersive space. If you need a stereo mix of your unmixed project, we are happy to provide that service as well for an additional fee.',
  },
  {
    question:
      "How do I review a Dolby Atmos mix if I don't have a multi-speaker studio?",
    answer:
      "You don't need a complex speaker setup to review our work. Our secure online system lets you play a reference file easily play on an iPhone, iPad, or Mac using AirPods or supported headphones. This utilizes Apple's native spatial rendering, allowing you to hear exactly how the mix will sound to the vast majority of your listeners on Apple Music.",
  },
  {
    question:
      'Will my Atmos mix sound quieter or weaker than my stereo master?',
    answer:
      'This is the most common issue with amateur Atmos mixing, but not with NovaSpatial. Dolby Atmos has strict loudness limits (-18 LUFS), which is quieter on paper than modern stereo masters. However, our proprietary Spatial Tone Lock workflow utilizes advanced spatial limiting and dynamic matching to ensure your mix retains its perceived impact, weight, and aggressive energy when users toggle between stereo and spatial on their devices.',
  },
  {
    question: 'What exactly is Spatial Tone Lock?',
    answer:
      'Spatial Tone Lock is our proprietary immersive mixing workflow. We use a combination of exclusive custom techniques for multi-channel clipping, musical compression, and spatial limiting, advanced audio reference tools, and expert engineering to ensure your Atmos mix retains the exact punch, glue, clipping, and emotional impact of your original stereo master.',
  },
  {
    question: 'Why do I need Spatial Tone Lock for my Atmos mix?',
    answer:
      "Because of the expanded dynamic range and strict loudness standards of Dolby Atmos, many standard immersive mixes end up sounding flat or lacking energy compared to the original stereo version. Spatial Tone Lock solves this by utilizing exclusive multi-channel compression and spatial limiting techniques to preserve your track's driving power and headroom.",
  },
  {
    question: 'Will my song sound different in spatial audio? ',
    answer:
      "It will sound bigger and more immersive, but it won't lose its core identity. We don't just randomly pan your stems around a room. We continuously cross-reference your stereo master and use high-end immersive reverbs and multi-tap delays to expand the soundstage while keeping your original sonic vision perfectly intact.",
  },
  {
    question:
      'How does Spatial Tone Lock ensure my mix translates to everyday headphones?',
    answer:
      'As the final step in the Tone Lock process, we rigorously run your mix through advanced spatial emulators. This allows us to double-check the rendering across Apple Spatial Audio, standard Binaural headphones (like AirPods), and multi-speaker setups (like Audiophile Home Systems, SoundBars and Atmos-equipped cars) to guarantee a flawless listening experience everywhere',
  },
]

export function FAQ() {
  return (
    <div className="mt-16 mb-8 sm:mt-24 sm:mb-12 xl:mt-32 xl:mb-12 3xl:mt-40 3xl:mb-16">
      <Container className="mt-0 sm:mt-2">
        <FadeIn>
          <div className="mx-auto text-center xl:max-w-4xl 3xl:max-w-5xl">
            <h2>
              <span className="mb-4 block font-display text-xs font-semibold text-white sm:mb-6 sm:text-base 3xl:mb-8 3xl:text-lg">
                FAQ
              </span>
              <span className="block font-display text-2xl font-medium tracking-tight text-balance text-white sm:text-4xl lg:text-5xl 3xl:text-6xl">
                Frequently asked questions
              </span>
            </h2>
            <p className="mt-4 text-xs text-zinc-300 sm:mt-6 sm:text-xl 3xl:mt-8 3xl:text-2xl">
              Can&apos;t find the answer you&apos;re looking for? Feel free to
              reach out to our team.
            </p>
          </div>
          <FadeInStagger className="mx-auto mt-12 max-w-xl divide-y divide-white/10 sm:mt-16 xl:mt-20 sm:max-w-2xl xl:max-w-3xl 3xl:max-w-4xl 3xl:mt-24">
            {faqs.map((faq) => (
              <FadeIn key={faq.question}>
                <Disclosure
                  as="div"
                  className="py-2 first:pt-0 last:pb-0 sm:py-3 3xl:py-4"
                >
                <dt>
                  <DisclosureButton className="group flex w-full items-start justify-between text-left text-white">
                    <span className="text-[10px]/4 font-semibold transition-colors duration-200 group-hover:text-zinc-300 sm:text-base/7 3xl:text-lg/8">
                      {faq.question}
                    </span>
                    <span className="ml-3 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-800/90 text-white ring-1 ring-white/10 transition-all duration-200 group-hover:scale-110 group-hover:bg-zinc-700/90 group-hover:ring-white/25 sm:ml-6 sm:h-7 sm:w-7 3xl:h-9 3xl:w-9">
                      <PlusSmallIcon
                        aria-hidden="true"
                        className="size-2.5 group-data-open:hidden sm:size-4 3xl:size-5"
                      />
                      <MinusSmallIcon
                        aria-hidden="true"
                        className="size-2.5 group-[&:not([data-open])]:hidden sm:size-4 3xl:size-5"
                      />
                    </span>
                  </DisclosureButton>
                </dt>
                <DisclosurePanel
                  as="dd"
                  className="mt-1 pr-6 sm:mt-2 sm:pr-12 3xl:mt-3"
                >
                  <p className="text-[10px]/4 text-zinc-300 sm:text-base/7 3xl:text-lg/8">
                    {faq.answer}
                  </p>
                </DisclosurePanel>
              </Disclosure>
              </FadeIn>
            ))}
          </FadeInStagger>
        </FadeIn>
      </Container>
    </div>
  )
}
