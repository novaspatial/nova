const checkIcon = (
  <svg
    className="h-4 w-4 shrink-0 sm:h-5 sm:w-5 xl:h-7 xl:w-7"
    viewBox="0 0 20 20"
  >
    <defs>
      <linearGradient id="check-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#5b21b6" />
        <stop offset="50%" stopColor="#4c1d95" />
        <stop offset="100%" stopColor="#3b0764" />
      </linearGradient>
    </defs>
    <path
      fillRule="evenodd"
      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
      clipRule="evenodd"
      fill="url(#check-gradient)"
    />
  </svg>
)

export function HeroContent() {
  return (
    <>
      <h1 className="max-w-none font-display text-2xl font-semibold tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl xl:text-6xl">
        Elevate your mix with <br />{' '}
        <span className="animate-hero-glow bg-gradient-to-r from-indigo-400 via-violet-500 to-purple-600 bg-[length:200%_auto] bg-clip-text text-transparent">
          NOVA Spatial Tone Lock
        </span>{' '}
        <br /> new standard in Atmos Mixing
      </h1>
      <p className="mt-3 max-w-sm text-xs text-neutral-300 sm:mt-6 sm:max-w-2xl sm:text-lg xl:mt-8 xl:max-w-4xl xl:text-2xl">
        Get world-class, remote Spatial Audio mixing from industry-leading
        engineers in our world class Dolby Atmos Certified Mix Studio. Our
        exclusive Spatial Tone Lock process guarantees your Immersive Mix
        retains the exact punch, glue, clipping and emotion of your original
        Stereo Master.
      </p>
      <ul className="mt-4 space-y-1.5 text-xs text-neutral-300 sm:mt-8 sm:space-y-3 sm:text-base xl:mt-10 xl:space-y-4 xl:text-xl">
        <li className="flex items-center gap-2 sm:gap-3">
          {checkIcon}
          Spatial Mixing and Mastering
        </li>
        <li className="flex items-center gap-2 sm:gap-3">
          {checkIcon}
          Expert engineers across all genres
        </li>
        <li className="flex items-center gap-2 sm:gap-3">
          {checkIcon}
          Proprietary Spatial Tone Lock mix matching
        </li>
        <li className="flex items-center gap-2 sm:gap-3">
          {checkIcon}
          Dolby Atmos Certified World Class Mix Studio
        </li>
        <li className="flex items-center gap-2 sm:gap-3">
          {checkIcon}
          Apple Music & Tidal compliant Dolby Atmos/Spatial ADM files
        </li>
      </ul>
    </>
  )
}
