import Image from 'next/image'
import Link from 'next/link'
import {
  Volume2,
  Search,
  TrendingUp,
  Shield,
  Sparkles,
  UploadCloud,
  Headphones,
  CheckCircle2,
  Lock,
  AudioWaveform,
  SlidersHorizontal,
  Box,
} from 'lucide-react'

import { Container } from '@/components/layout/Container'
import { FadeIn } from '@/components/ui/FadeIn'
import nova from '@/images/nova.jpg'

const atmosAdvantages = [
  {
    icon: Volume2,
    title: 'Sound bigger.',
    description:
      'Three-dimensional audio. Unprecedented depth and dynamic range.',
  },
  {
    icon: Search,
    title: 'Get discovered faster.',
    description:
      "Apple Music's algorithm actively favors Atmos-enabled tracks — better placement, more reach.",
  },
  {
    icon: TrendingUp,
    title: 'Earn more per stream.',
    description: 'Apple pays higher royalty rates for Spatial Audio releases.',
  },
  {
    icon: Shield,
    title: 'Future-proof your catalog.',
    description:
      'Atmos is rapidly becoming the streaming standard — release-ready today, still relevant tomorrow.',
  },
  {
    icon: Sparkles,
    title: 'Premium positioning.',
    description:
      'Stand shoulder-to-shoulder with top-tier artists delivering in the format listeners expect.',
  },
]

const portalFeatures = [
  {
    icon: UploadCloud,
    title: 'Secure file uploads.',
    description: 'Fast, private, and simple.',
  },
  {
    icon: Headphones,
    title: 'Atmos & Binaural playback.',
    description: 'Hear your mix exactly as intended, in any format.',
  },
  {
    icon: CheckCircle2,
    title: 'Apple Music & Tidal compliant delivery.',
    description: 'Final files ready to distribute.',
  },
]

const toneLockFeatures = [
  {
    icon: AudioWaveform,
    title: 'Platform-perfect translation.',
    description:
      'Every streaming platform renders Spatial Audio differently. Spatial Tone Lock ensures flawless playback across all of them.',
  },
  {
    icon: SlidersHorizontal,
    title: 'The technical edge.',
    description:
      'Multi-channel limiting, musical compression, and precision EQ matching maximize headroom and immersive depth without losing the original vibe.',
  },
  {
    icon: Box,
    title: 'Depth that feels real.',
    description:
      'Rather than simply panning audio to different speakers, we use industry-leading immersive reverbs, multi-tap delays, and chorus effects to build a true three-dimensional environment around your music.',
  },
]

function FeatureRow({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Volume2
  title: string
  description: string
}) {
  return (
    <div className="group/row flex items-start gap-3 sm:gap-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 transition-all duration-300 group-hover/row:scale-110 group-hover/row:bg-white/10 group-hover/row:ring-white/20 sm:size-11 3xl:size-12">
        <Icon className="size-4 text-white/90 transition-colors duration-300 group-hover/row:text-white sm:size-5 3xl:size-6" />
      </div>
      <p className="text-xs leading-relaxed text-zinc-300 sm:text-sm 3xl:text-base">
        <strong className="font-semibold text-white">{title}</strong>{' '}
        {description}
      </p>
    </div>
  )
}

function AtmosAdvantageCard() {
  return (
    <FadeIn className="h-full">
      <div className="h-full rounded-2xl bg-white/3 p-5 ring-1 ring-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/6 hover:ring-white/20 hover:shadow-xl hover:shadow-violet-500/20 sm:p-7 3xl:p-9">
        <h3 className="font-display text-lg font-medium tracking-tight text-white sm:text-2xl 3xl:text-3xl">
          The Atmos Advantage
        </h3>
        <div className="mt-4 space-y-4 sm:mt-6 sm:space-y-5 3xl:mt-8 3xl:space-y-6">
          {atmosAdvantages.map((item) => (
            <FeatureRow key={item.title} {...item} />
          ))}
        </div>
      </div>
    </FadeIn>
  )
}

function PortalMockup() {
  return (
    <div className="mt-5 overflow-hidden rounded-xl bg-zinc-950/60 p-3.5 ring-1 ring-white/10 sm:mt-6 sm:p-5 3xl:mt-8 3xl:p-6">
      <div className="space-y-3.5 sm:space-y-4 3xl:space-y-5">
        <div>
          <label className="block text-[10px] font-medium tracking-wide text-zinc-400 uppercase sm:text-[11px]">
            Project Title
          </label>
          <div className="mt-1.5 rounded-lg bg-white/3 px-3 py-2 text-xs text-zinc-500 ring-1 ring-white/10 sm:px-3.5 sm:py-2.5 sm:text-sm">
            e.g. Album Name – Dolby Atmos Mix
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium tracking-wide text-zinc-400 uppercase sm:text-[11px]">
            Target Format
          </label>
          <div className="mt-1.5 flex flex-wrap gap-1.5 sm:gap-2">
            <span className="rounded-full bg-linear-to-r from-violet-950 via-purple-900 to-violet-950 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-violet-400/30 sm:px-3.5 sm:py-1.5 sm:text-xs">
              Dolby Atmos
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-400 ring-1 ring-white/10 sm:px-3.5 sm:py-1.5 sm:text-xs">
              Binaural
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-400 ring-1 ring-white/10 sm:px-3.5 sm:py-1.5 sm:text-xs">
              Both
            </span>
          </div>
        </div>
        <div className="-mb-8 sm:-mb-10">
          <label className="block text-[10px] font-medium tracking-wide text-zinc-400 uppercase sm:text-[11px]">
            Project Notes (optional)
          </label>
          <div className="mt-1.5 h-8 rounded-lg bg-white/3 ring-1 ring-white/10 sm:h-10" />
        </div>
      </div>
    </div>
  )
}

function NoAtmosCard() {
  return (
    <FadeIn className="h-full">
      <div className="h-full rounded-2xl bg-white/3 p-5 ring-1 ring-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/6 hover:ring-white/20 hover:shadow-xl hover:shadow-violet-500/20 sm:p-7 3xl:p-9">
        <h3 className="font-display text-lg font-medium tracking-tight text-white sm:text-2xl 3xl:text-3xl">
          No Atmos System? No Problem.
        </h3>
        <p className="mt-3 text-xs leading-relaxed text-zinc-300 sm:mt-4 sm:text-sm 3xl:mt-5 3xl:text-base">
          Our client portal lets you preview your spatial mix in binaural
          playback — exactly how listeners on headphones and stereo setups will
          hear it. Review, approve, and sign off with confidence. No special
          hardware required.
        </p>
        <PortalMockup />
      </div>
    </FadeIn>
  )
}

function PortalFeatureTile({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Volume2
  title: string
  description: string
}) {
  return (
    <div className="group/tile flex flex-col items-center text-center">
      <div className="flex size-11 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 transition-all duration-300 group-hover/tile:scale-110 group-hover/tile:bg-white/10 group-hover/tile:ring-white/20 sm:size-14 3xl:size-16">
        <Icon className="size-5 text-white/90 transition-colors duration-300 group-hover/tile:text-white sm:size-6 3xl:size-7" />
      </div>
      <h4 className="mt-3 font-display text-sm font-semibold text-white sm:mt-4 sm:text-base 3xl:text-lg">
        {title}
      </h4>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-400 sm:mt-2 sm:text-sm 3xl:text-base">
        {description}
      </p>
    </div>
  )
}

function PortalFeaturesCard() {
  return (
    <FadeIn className="h-full lg:col-span-2">
      <div className="h-full rounded-2xl bg-white/3 p-5 ring-1 ring-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/6 hover:ring-white/20 hover:shadow-xl hover:shadow-violet-500/20 sm:p-7 3xl:p-9">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8 3xl:gap-10">
          {portalFeatures.map((item) => (
            <PortalFeatureTile key={item.title} {...item} />
          ))}
        </div>
        <div className="mt-7 flex justify-center sm:mt-9 3xl:mt-11">
          <Link
            href="/portal"
            className="group/cta relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-linear-to-r from-violet-950 via-purple-900 to-violet-950 px-5 py-2.5 text-xs font-semibold text-white ring-1 ring-violet-400/30 transition-all duration-300 hover:scale-[1.03] hover:ring-violet-300/50 hover:shadow-lg hover:shadow-violet-500/30 sm:px-7 sm:py-3 sm:text-sm 3xl:px-8 3xl:py-3.5 3xl:text-base"
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover/cta:translate-x-full" />
            <span className="relative">Start Your Project</span>
          </Link>
        </div>
      </div>
    </FadeIn>
  )
}

function ToneLockFeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Volume2
  title: string
  description: string
}) {
  return (
    <div className="group rounded-xl bg-white/3 p-4 ring-1 ring-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/6 hover:ring-white/20 hover:shadow-lg hover:shadow-violet-500/20 sm:p-5 3xl:p-6">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 transition-all duration-300 group-hover:scale-110 group-hover:bg-white/10 group-hover:ring-white/20 sm:size-11 3xl:size-12">
          <Icon className="size-4 text-white/90 transition-colors duration-300 group-hover:text-white sm:size-5 3xl:size-6" />
        </div>
        <div className="min-w-0">
          <h4 className="font-display text-sm font-semibold text-white sm:text-base 3xl:text-lg">
            {title}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400 sm:text-sm 3xl:text-base">
            {description}
          </p>
        </div>
      </div>
    </div>
  )
}

function SpatialToneLockBlock() {
  return (
    <FadeIn>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-400/30 sm:size-14 3xl:size-16">
          <Lock className="size-4 text-violet-300 sm:size-6 3xl:size-7" />
        </div>
        <h3 id="spatial-tone-lock" className="scroll-mt-28 font-display text-3xl font-medium tracking-tight text-white sm:text-5xl 3xl:text-6xl">
          Spatial Tone Lock
        </h3>
      </div>
      <div className="mt-4 space-y-3 text-xs leading-relaxed text-zinc-300 sm:mt-6 sm:space-y-4 sm:text-sm 3xl:mt-8 3xl:text-base">
        <p className="italic text-zinc-400">
          Your stereo master is a carefully crafted piece of art — every
          limiter smash, every clipping decision, every sonic quirk is
          intentional. But when it comes to Spatial Audio, most engineers
          don&apos;t apply that same obsessive attention to detail. The result?
          A wider mix that somehow feels smaller.
        </p>
        <p>
          <strong className="font-semibold text-white">
            Our solution: Spatial Tone Lock.
          </strong>{' '}
          NOVA&apos;s proprietary workflow combines highly trained engineers
          with exclusive plugins and reference tools, engineered to guarantee
          your spatial mix hits just as hard as the original.
        </p>
      </div>
      <div className="mt-5 space-y-3 sm:mt-6 sm:space-y-4 3xl:mt-8">
        {toneLockFeatures.map((item) => (
          <ToneLockFeatureCard key={item.title} {...item} />
        ))}
      </div>
    </FadeIn>
  )
}

function StudioImage() {
  return (
    <FadeIn className="h-full">
      <div className="group/image relative flex h-full min-h-80 w-full overflow-hidden rounded-2xl shadow-lg shadow-violet-500/0 transition-shadow duration-700 ease-out hover:shadow-2xl hover:shadow-violet-500/25 sm:min-h-112 lg:min-h-full">
        <Image
          src={nova}
          alt=""
          className="h-full w-full object-cover transition duration-700 ease-out group-hover/image:scale-[1.03]"
          sizes="(min-width: 1024px) 50vw, 100vw"
        />
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10 transition-all duration-700 group-hover/image:ring-violet-400/30" />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-violet-600/0 via-white/0 to-violet-400/0 transition-all duration-700 group-hover/image:from-violet-600/5 group-hover/image:via-white/10 group-hover/image:to-violet-400/0" />
      </div>
    </FadeIn>
  )
}

export function Services() {
  return (
    <div className="mt-6 sm:mt-8 lg:mt-10">
      <Container>
        <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-10 3xl:gap-12">
          <SpatialToneLockBlock />
          <StudioImage />
          <AtmosAdvantageCard />
          <NoAtmosCard />
          <PortalFeaturesCard />
        </div>
      </Container>
    </div>
  )
}
