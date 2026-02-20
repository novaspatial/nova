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
    question: "What's the best thing about Switzerland?",
    answer:
      "I don't know, but the flag is a big plus. Lorem ipsum dolor sit amet consectetur adipisicing elit. Quas cupiditate laboriosam fugiat.",
  },
  {
    question: 'How do you make holy water?',
    answer:
      'You boil the hell out of it. Lorem ipsum dolor sit amet consectetur adipisicing elit. Magnam aut tempora vitae odio inventore fuga aliquam nostrum quod porro. Delectus quia facere id sequi expedita natus.',
  },
  {
    question: 'What do you call someone with no body and no nose?',
    answer:
      'Nobody knows. Lorem ipsum dolor sit amet consectetur adipisicing elit. Culpa, voluptas ipsa quia excepturi, quibusdam natus exercitationem sapiente tempore labore voluptatem.',
  },
  {
    question: 'Why do you never see elephants hiding in trees?',
    answer:
      "Because they're so good at it. Lorem ipsum dolor sit amet consectetur adipisicing elit. Quas cupiditate laboriosam fugiat.",
  },
  {
    question: "Why can't you hear a pterodactyl go to the bathroom?",
    answer:
      'Because the pee is silent. Lorem ipsum dolor sit amet, consectetur adipisicing elit. Ipsam, quas voluptatibus ex culpa ipsum, aspernatur blanditiis fugiat ullam magnam suscipit deserunt illum natus facilis atque vero consequatur! Quisquam, debitis error.',
  },
  {
    question: 'Why did the invisible man turn down the job offer?',
    answer:
      "He couldn't see himself doing it. Lorem ipsum dolor sit, amet consectetur adipisicing elit. Eveniet perspiciatis officiis corrupti tenetur. Temporibus ut voluptatibus, perferendis sed unde rerum deserunt eius.",
  },
]

export function FAQ() {
  return (
    <div className="mt-24 mb-24 sm:mt-40 sm:mb-40 xl:mt-56 xl:mb-56 3xl:mt-72 3xl:mb-72">
      <Container className="mt-6 sm:mt-16">
        <FadeIn>
          <div className="xl:max-w-4xl 3xl:max-w-5xl mx-auto">
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
          <dl className="mt-6 sm:mt-16 xl:max-w-4xl 3xl:max-w-5xl mx-auto divide-y divide-white/10">
            {faqs.map((faq) => (
              <Disclosure
                key={faq.question}
                as="div"
                className="py-2.5 sm:py-6 3xl:py-8 first:pt-0 last:pb-0"
              >
                <dt>
                  <DisclosureButton className="group flex w-full items-start justify-between text-left text-white">
                    <span className="text-[10px]/4 sm:text-base/7 3xl:text-lg/8 font-semibold">
                      {faq.question}
                    </span>
                    <span className="ml-3 sm:ml-6 flex h-4 w-4 sm:h-7 sm:w-7 3xl:h-9 3xl:w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-900/60 via-violet-800/60 to-purple-900/60 text-white shadow-lg shadow-violet-500/30">
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
