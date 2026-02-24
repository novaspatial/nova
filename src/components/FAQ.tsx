'use client'

import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from '@headlessui/react'
import { MinusSmallIcon, PlusSmallIcon } from '@heroicons/react/24/outline'

import { Container } from '@/components/Container'
import { FadeIn } from '@/components/FadeIn'

const faqs = [
  {
    question: "What files do I need to send for a Dolby Atmos mix?",
    answer:
    "We require your consolidated stems (WAV, 24-bit or 32-bit float, 48kHz native preferred) and your final, approved Stereo Master. All stems must start at exactly the same timecode so they line up perfectly when dropped into our system."
  },
  {
    question: 'Should my stems be "wet" (with effects) or "dry"?',
    answer:
    "We need \u201cwet\u201d stems. Because our goal is to perfectly translate your original vision using our Spatial Tone Lock\u2122 process, your stems should include all your EQ, compression, delays, and reverbs. When all your stems are played together at zero (unity gain), they should sound identical to your final stereo mix."
  },
  {
    question: 'Do I need to have my song mixed in stereo first?',
    answer:
  "Yes. We highly recommend having a finished and approved stereo mix before moving to the Atmos stage. The stereo master acts as the blueprint for our engineers to match the punch, glue, and emotion of your record in the immersive space. If you need a stereo mix of your unmixed project, we are happy to provide that service as well for an additional fee."},
  {
    question: "How do I review a Dolby Atmos mix if I don't have a multi-speaker studio?",
    answer:
"You don't need a complex speaker setup to review our work. Our secure online system lets you play a reference file easily play on an iPhone, iPad, or Mac using AirPods or supported headphones. This utilizes Apple's native spatial rendering, allowing you to hear exactly how the mix will sound to the vast majority of your listeners on Apple Music." },
  {
    question: "Will my Atmos mix sound quieter or weaker than my stereo master?",
    answer:
"This is the most common issue with amateur Atmos mixing, but not with NovaSpatial. Dolby Atmos has strict loudness limits (-18 LUFS), which is quieter on paper than modern stereo masters. However, our proprietary Spatial Tone Lock workflow utilizes advanced spatial limiting and dynamic matching to ensure your mix retains its perceived impact, weight, and aggressive energy when users toggle between stereo and spatial on their devices."},
  {
    question: 'Why did the invisible man turn down the job offer?',
    answer:
      "He couldn't see himself doing it. Lorem ipsum dolor sit, amet consectetur adipisicing elit. Eveniet perspiciatis officiis corrupti tenetur. Temporibus ut voluptatibus, perferendis sed unde rerum deserunt eius.",
  },
]

export function FAQ() {
  return (
    <div className="mt-24 mb-24 sm:mt-40 sm:mb-40 xl:mt-56 xl:mb-28 3xl:mt-72 3xl:mb-36">
      <Container className="mt-6 sm:mt-16">
        <FadeIn>
          <div className="xl:max-w-4xl 3xl:max-w-5xl mx-auto text-center">
            <h2>
              <span className="mb-4 sm:mb-6 3xl:mb-8 block font-display text-xs sm:text-base 3xl:text-lg font-semibold text-white">
                FAQ
              </span>
              <span className="block font-display tracking-tight text-balance text-2xl font-medium sm:text-4xl lg:text-5xl 3xl:text-6xl text-white">
                Frequently asked questions
              </span>
            </h2>
            <p className="mt-4 sm:mt-6 3xl:mt-8 text-xs sm:text-xl 3xl:text-2xl text-neutral-300">
              Can&apos;t find the answer you&apos;re looking for? Feel free to reach
              out to our team.
            </p>
          </div>
          <dl className="mt-6 sm:mt-16 max-w-xl sm:max-w-2xl xl:max-w-3xl 3xl:max-w-4xl mx-auto divide-y divide-white/10">
            {faqs.map((faq) => (
              <Disclosure
                key={faq.question}
                as="div"
                className="py-2.5 sm:py-6 3xl:py-8 first:pt-0 last:pb-0"
              >
                <dt>
                  <DisclosureButton className="group flex w-full items-start justify-between text-left text-white">
                    <span className="text-[10px]/4 sm:text-base/7 3xl:text-lg/8 font-semibold transition-colors duration-200 group-hover:text-neutral-300">
                      {faq.question}
                    </span>
                    <span className="ml-3 sm:ml-6 flex h-4 w-4 sm:h-7 sm:w-7 3xl:h-9 3xl:w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800/90 ring-1 ring-white/10 text-white transition-all duration-200 group-hover:bg-zinc-700/90 group-hover:ring-white/25 group-hover:scale-110">
                      <PlusSmallIcon
                        aria-hidden="true"
                        className="size-2.5 sm:size-4 3xl:size-5 group-data-open:hidden"
                      />
                      <MinusSmallIcon
                        aria-hidden="true"
                        className="size-2.5 sm:size-4 3xl:size-5 group-[&:not([data-open])]:hidden"
                      />
                    </span>
                  </DisclosureButton>
                </dt>
                <DisclosurePanel as="dd" className="mt-1 sm:mt-2 3xl:mt-3 pr-6 sm:pr-12">
                  <p className="text-[10px]/4 sm:text-base/7 3xl:text-lg/8 text-neutral-300">
                    {faq.answer}
                  </p>
                </DisclosurePanel>
              </Disclosure>
            ))}
          </dl>
        </FadeIn>
      </Container>
    </div>
  )
}
