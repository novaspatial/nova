import {
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
  MicrophoneIcon,
  MusicalNoteIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/24/solid'

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-xs text-zinc-200">
      {children}
    </code>
  )
}

function CheckRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-zinc-300">
      <CheckIcon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-emerald-400"
      />
      <span>{children}</span>
    </li>
  )
}

function CautionRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="group/caution flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-2.5 py-2 text-sm text-red-200 transition-colors duration-200 ease-out hover:border-red-500/50 hover:bg-red-500/10">
      <ExclamationTriangleIcon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-red-300 transition-transform duration-200 ease-out group-hover/caution:-rotate-6 group-hover/caution:scale-110"
      />
      <span>{children}</span>
    </li>
  )
}

function Group({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="group/card rounded-xl border border-white/10 bg-white/3 p-4 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-violet-500/25 hover:bg-white/5 hover:shadow-lg hover:shadow-violet-500/10 sm:p-5">
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden="true"
          className="size-5 shrink-0 text-violet-300 transition-all duration-300 ease-out group-hover/card:scale-110 group-hover/card:text-violet-200"
        />
        <h3 className="text-sm font-semibold text-white transition-colors duration-200 group-hover/card:text-white">
          {title}
        </h3>
      </div>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  )
}

function FaqItem({
  question,
  children,
}: {
  question: string
  children: React.ReactNode
}) {
  return (
    <details className="group/faq rounded-xl border border-white/10 bg-white/3 transition-all duration-200 ease-out hover:border-white/20 hover:bg-white/5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-zinc-200 transition-colors duration-200 ease-out hover:text-white active:scale-[0.99] [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-zinc-400 transition-all duration-300 ease-out group-hover/faq:text-zinc-200 group-open/faq:rotate-180"
        />
      </summary>
      <div className="px-4 pb-4 pt-1 text-sm leading-relaxed text-zinc-400">
        {children}
      </div>
    </details>
  )
}

export function UploadPrep({
  collapsible = false,
  footer,
}: { collapsible?: boolean; footer?: React.ReactNode } = {}) {
  const body = (
    <>
      <p className="text-sm text-zinc-400">
        Following these steps means less back-and-forth and more time spent on
        the creative work.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Group icon={DocumentIcon} title="File specs">
          <CheckRow>
            WAV or AIFF, 24-bit, 48 kHz or 96 kHz (please avoid 44.1 kHz)
          </CheckRow>
          <CheckRow>
            Every stem consolidated from bar 1 — all stems the same length and
            same start point
          </CheckRow>
          <CheckRow>
            Include tempo / BPM in the zip filename or a notes file inside the
            zip
          </CheckRow>
        </Group>

        <Group icon={AdjustmentsHorizontalIcon} title="Your mix">
          <CheckRow>
            Stems should sum to your final approved stereo mix
          </CheckRow>
          <CheckRow>Same balance, same tonality, same energy</CheckRow>
          <CheckRow>Include a bounce of that stereo mix as a reference</CheckRow>
        </Group>

        <Group icon={MicrophoneIcon} title="Vocals">
          <CheckRow>
            Deliver dry vocal stems — printed EQ, compression, tuning, and
            saturation are fine
          </CheckRow>
          <CheckRow>
            Print those vocal effects on their own separate stems (one per
            effect when possible)
          </CheckRow>
          <CautionRow>
            Do NOT bounce reverb, delay, or other spatial effects onto the vocal
            itself
          </CautionRow>
        </Group>

        <Group icon={MusicalNoteIcon} title="Other instruments">
          <CheckRow>
            Printed processing and effects are generally fine on drums, bass,
            guitars, and synths
          </CheckRow>
          <CheckRow>
            Anything you want us to spatialize — long reverbs, stereo delays,
            wide pads, ambient textures — should be delivered on its own stem,
            not baked into the source instrument
          </CheckRow>
        </Group>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white">FAQ</h3>
        <div className="mt-3 space-y-2">
          <FaqItem question="Why do the stems need to match the final stereo mix?">
            <p>
              Your stereo mix is our starting point. We&apos;re translating your
              creative intent into three dimensions, not re-mixing the song. If
              the stems don&apos;t sum to something close to your approved mix,
              we end up guessing at balance instead of focusing on the immersive
              work.
            </p>
          </FaqItem>

          <FaqItem question="Why 48 kHz or 96 kHz, 24-bit?">
            <p>
              Dolby Atmos masters are delivered at 48 kHz, so that&apos;s the
              safest path. If your session is at 96 kHz, send it at its native
              rate — we&apos;ll handle it on our side. 44.1 kHz forces a sample
              rate conversion that we&apos;d rather avoid.
            </p>
          </FaqItem>

          <FaqItem question="Why separate the spatial effects from the vocal?">
            <p>
              Vocals carry the emotion of the song — they&apos;re what listeners
              lock onto. In Atmos we can place reverbs and delays anywhere
              around the listener: above, behind, off to the sides. If those
              effects are already glued to the vocal stem, we lose that
              flexibility. Delivering them on their own stems lets us either
              spatialize them directly or faithfully recreate them using true
              immersive reverbs.
            </p>
          </FaqItem>

          <FaqItem question="What about effects on drums, guitars, and synths?">
            <p>
              Printed processing on these is usually fine — compression,
              saturation, EQ, tape, even short ambience. The rule of thumb: if
              you&apos;d like a specific effect to move, wrap around, or feel
              three-dimensional, put it on its own stem. If it&apos;s part of
              the core sound of the instrument, bake it in.
            </p>
          </FaqItem>

          <FaqItem question="How many stems do you need?">
            <p>
              As many as it takes to preserve your vision. A typical delivery is
              anywhere from 8 to 30+ stems, but there&apos;s no hard rule. More
              granularity gives us more creative control; too few limits what we
              can do spatially. When in doubt, send more.
            </p>
          </FaqItem>

          <FaqItem question="How should I name and organize the stems?">
            <p>
              Use clear, descriptive names — <Mono>01_Kick.wav</Mono>,{' '}
              <Mono>02_Snare.wav</Mono>, <Mono>10_Lead_Vox_Dry.wav</Mono>,{' '}
              <Mono>11_Lead_Vox_Reverb.wav</Mono>. Group related stems by prefix
              or folder (<Mono>DRUMS</Mono>, <Mono>BASS</Mono>, <Mono>VOX</Mono>,{' '}
              <Mono>FX</Mono>). If we have to guess what{' '}
              <Mono>V_FX_2_bus.wav</Mono> is, it slows us down.
            </p>
          </FaqItem>

          <FaqItem question="How do I send everything?">
            <p>
              Zip your stems, your reference stereo mix, and any session notes,
              and upload through our client portal. Include the tempo/BPM in the
              zip filename — e.g.,{' '}
              <Mono>ArtistName_SongTitle_120bpm.zip</Mono> — or in a plain-text
              notes file inside the zip.
            </p>
          </FaqItem>
        </div>
      </div>

      {footer && (
        <div className="border-t border-white/10 pt-6">{footer}</div>
      )}
    </>
  )

  if (collapsible) {
    return (
      <details className="group/prep rounded-2xl border border-white/10 bg-white/2 shadow-2xl shadow-violet-500/5 backdrop-blur-sm transition-all duration-300 ease-out hover:border-white/15 hover:shadow-violet-500/10 open:border-violet-500/20 open:shadow-violet-500/10">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-6 transition-colors duration-200 ease-out hover:bg-white/3 active:scale-[0.995] sm:p-8 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2">
            <SparklesIcon
              aria-hidden="true"
              className="size-5 shrink-0 text-violet-300 transition-transform duration-500 ease-out group-hover/prep:rotate-12 group-hover/prep:scale-110"
            />
            <h2 className="text-lg font-semibold text-white sm:text-xl">
              Preparing Your Stems for a Dolby Atmos Mix
            </h2>
          </div>
          <ChevronDownIcon
            aria-hidden="true"
            className="size-5 shrink-0 text-zinc-400 transition-all duration-300 ease-out group-hover/prep:text-zinc-200 group-open/prep:rotate-180 group-open/prep:text-violet-300"
          />
        </summary>
        <div className="space-y-6 border-t border-white/10 p-6 sm:p-8">
          {body}
        </div>
      </details>
    )
  }

  return (
    <section
      aria-labelledby="upload-prep-title"
      className="space-y-6 rounded-2xl border border-white/10 bg-white/2 p-6 shadow-2xl shadow-violet-500/5 backdrop-blur-sm sm:p-8"
    >
      <div className="flex items-center gap-2">
        <SparklesIcon
          aria-hidden="true"
          className="size-5 shrink-0 text-violet-300"
        />
        <h2
          id="upload-prep-title"
          className="text-lg font-semibold text-white sm:text-xl"
        >
          Preparing Your Stems for a Dolby Atmos Mix
        </h2>
      </div>
      {body}
    </section>
  )
}
