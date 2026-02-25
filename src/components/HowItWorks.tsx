'use client'

import { useState } from 'react'
import { Container } from '@/components/Container'
import { FadeIn, FadeInStagger } from '@/components/FadeIn'
import { Button } from '@/components/Button'
import {
  ArrowUpTrayIcon,
  MusicalNoteIcon,
  ChatBubbleLeftRightIcon,
  ArrowDownTrayIcon,
  ChevronDownIcon,
  ClockIcon,
  CreditCardIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

const steps = [
  {
    number: 1,
    icon: ArrowUpTrayIcon,
    title: 'Secure Upload',
    description:
      'Securely transfer your multitrack stems and final Stereo Master reference to our dedicated project portal.',
  },
  {
    number: 2,
    icon: MusicalNoteIcon,
    title: 'Interactive Listening',
    description:
      'Experience your new spatial mix through our secure online platform, featuring both high-fidelity Binaural and true Dolby Atmos playback options.',
  },
  {
    number: 3,
    icon: ChatBubbleLeftRightIcon,
    title: 'Timestamped Revisions',
    description:
      'Easily drop precise, timestamped mix notes and feedback directly on the track timeline to ensure every detail matches your vision perfectly.',
  },
  {
    number: 4,
    icon: ArrowDownTrayIcon,
    title: 'Platform-Ready Delivery',
    description:
      'Download your approved, fully compliant ADM BWF master files — ready for immediate release on Apple Music, Tidal, Amazon Music, and all immersive streaming platforms.',
  },
]

const trustBadges = [
  { icon: ClockIcon, label: 'Full-length preview' },
  { icon: CreditCardIcon, label: 'No credit card required' },
  { icon: UserGroupIcon, label: 'You keep all rights' },
]

function TimelineStep({
  step,
  index,
}: {
  step: (typeof steps)[0]
  index: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const Icon = step.icon
  const isEven = index % 2 === 0

  return (
    <FadeIn>
      <div className="group relative flex items-center justify-center lg:justify-start">
        {/* Timeline line (hidden on mobile, visible on desktop) */}
        <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-linear-to-b from-white/20 via-white/10 to-white/20 lg:block" />

        {/* Number circle */}
        <div className="absolute left-1/2 top-3 z-10 flex size-9 -translate-x-1/2 items-center justify-center rounded-full bg-linear-to-br from-indigo-900/80 via-violet-800/80 to-purple-900/80 text-xs font-bold text-white ring-1 ring-white/20 transition-all duration-300 group-hover:scale-110 group-hover:ring-white/30 sm:top-4 sm:size-10 sm:text-sm lg:top-6 3xl:size-12 3xl:text-base">
          {step.number}
        </div>

        {/* Card container */}
        <div
          className={`w-full px-3 pt-14 sm:px-6 sm:pt-20 md:pt-16 lg:w-1/2 lg:pt-0 ${
            isEven ? 'lg:pr-12 xl:pr-16' : 'lg:ml-auto lg:pl-12 xl:pl-16'
          }`}
        >
          <div className="group min-w-0 rounded-xl bg-white/3 p-4 ring-1 ring-white/10 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/6 hover:ring-white/20 hover:shadow-xl hover:shadow-violet-500/20 sm:p-5 3xl:p-6">
          {/* Header row: title + icon */}
          <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-3">
            <h3 className="min-w-0 truncate font-display text-sm font-semibold text-white sm:text-lg 3xl:text-xl">
              {step.title}
            </h3>
            <div className="flex shrink-0 size-8 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 transition-all duration-300 group-hover:scale-110 group-hover:bg-white/10 group-hover:ring-white/20 sm:size-8 3xl:size-9">
              <Icon className="size-4 text-white/90 transition-all duration-300 group-hover:text-white group-hover:scale-105 sm:size-5 3xl:size-5" />
            </div>
          </div>

          {/* Description */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isExpanded ? 'max-h-96' : 'max-h-14 sm:max-h-14 3xl:max-h-16'
            }`}
          >
            <p className="mt-2 text-xs leading-relaxed text-neutral-400 sm:text-sm 3xl:text-base">
              {step.description}
            </p>
          </div>

          {/* Read More button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            className="mt-3 flex min-h-11 items-center gap-1.5 py-2 text-xs font-medium text-white/80 transition-all duration-200 hover:gap-2 hover:text-white sm:mt-3 sm:min-h-0 sm:py-0 3xl:text-sm"
          >
            <span>{isExpanded ? 'Show Less' : 'Show More'}</span>
            <ChevronDownIcon
              className={`size-3 transition-transform duration-300 sm:size-3.5 3xl:size-4 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>
    </div>
    </FadeIn>
  )
}

export function HowItWorks() {
  return (
    <div className="mt-8 mb-16 sm:mt-20 sm:mb-32 md:mt-24 xl:mt-32 xl:mb-24 3xl:mt-44 3xl:mb-32">
      <Container>
        <FadeInStagger faster>
          {/* Header */}
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center 3xl:max-w-3xl">
              <h2 className="font-display text-xl font-medium tracking-tight text-white sm:text-2xl md:text-4xl lg:text-5xl 3xl:text-6xl">
                Seamless Remote Collaboration
              </h2>
              <p className="mt-2 text-sm text-neutral-400 sm:mt-5 sm:text-base md:text-lg 3xl:mt-6 3xl:text-xl">
                Our streamlined workflow makes world-class spatial mixing
                effortless, no matter where you are in the world.
              </p>
            </div>
          </FadeIn>

          {/* Timeline */}
          <div className="relative mx-auto mt-8 max-w-5xl sm:mt-14 md:mt-16 lg:mt-16 3xl:mt-20">
            <div className="space-y-4 sm:space-y-10 md:space-y-12 lg:space-y-16 3xl:space-y-20">
              {steps.map((step, index) => (
                <TimelineStep key={step.number} step={step} index={index} />
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <FadeIn>
            <div className="mt-8 flex justify-center px-2 sm:mt-14 3xl:mt-16">
              <Button href="/contact" className="w-full sm:w-auto sm:min-w-50">
                Start Your Spatial Mix
              </Button>
            </div>
          </FadeIn>

          {/* Trust badges */}
          <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-3 sm:mt-8 sm:gap-6 3xl:mt-10 3xl:gap-8">
            {trustBadges.map(({ icon: Icon, label }) => (
              <FadeIn key={label}>
                <div className="group flex cursor-default items-center gap-1.5 transition-all duration-300 hover:scale-105 3xl:gap-2">
                  <Icon className="size-4 text-neutral-500 transition-colors duration-300 group-hover:text-violet-400 sm:size-4 3xl:size-5" />
                  <span className="text-xs text-neutral-500 transition-colors duration-300 group-hover:text-neutral-300 sm:text-xs 3xl:text-sm">
                    {label}
                  </span>
                </div>
              </FadeIn>
            ))}
          </div>
        </FadeInStagger>
      </Container>
    </div>
  )
}
