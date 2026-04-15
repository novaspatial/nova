'use client'

import Image, { StaticImageData } from 'next/image'
import { useState } from 'react'

interface PersonCardProps {
  name: string
  role: string
  bio: string
  image: { src: StaticImageData | string }
}

export function PersonCard({ name, role, bio, image }: PersonCardProps) {
  const [bioOpen, setBioOpen] = useState(false)

  return (
    <div className="group relative rounded-3xl p-px">
      <div
        className="absolute inset-0 rounded-3xl animate-border-flow opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            'conic-gradient(from var(--border-angle, 0deg), transparent 60%, #a78bfa 78%, #c084fc 82%, #7c3aed 90%, transparent 100%)',
        }}
      />
      <div className="relative overflow-hidden rounded-3xl bg-white/10">
        <Image
          alt=""
          {...image}
          className="h-96 w-full object-cover grayscale transition duration-500 motion-safe:group-hover:scale-105"
        />

        {/* Bio overlay */}
        <div
          className={`absolute inset-0 flex flex-col justify-end bg-black/75 backdrop-blur-sm p-6 transition-all duration-300 ${
            bioOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-base/6 font-semibold tracking-wide text-white">
                {name}
              </p>
              <p className="mt-1 text-sm text-white/60">{role}</p>
            </div>
            <button
              onClick={() => setBioOpen(false)}
              aria-label="Hide bio"
              className="shrink-0 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:border-transparent hover:bg-linear-to-r hover:from-violet-950 hover:via-purple-900 hover:to-violet-950 hover:ring-1 hover:ring-violet-500/20"
            >
              Close
            </button>
          </div>
          <p className="mt-3 text-sm/relaxed text-white/80">{bio}</p>
        </div>

        {/* Name / role bar — hidden when bio is open */}
        <div
          className={`absolute inset-0 flex flex-col justify-end bg-linear-to-t from-black to-black/0 to-40% p-6 transition-opacity duration-300 ${
            bioOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="font-display text-base/6 font-semibold tracking-wide text-white">
                {name}
              </p>
              <p className="mt-2 text-sm text-white">{role}</p>
            </div>
            <button
              onClick={() => setBioOpen(true)}
              aria-label="Show bio"
              className="shrink-0 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition hover:border-transparent hover:bg-linear-to-r hover:from-violet-950 hover:via-purple-900 hover:to-violet-950 hover:ring-1 hover:ring-violet-500/20"
            >
              Bio
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
