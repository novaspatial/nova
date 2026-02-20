const checkIcon = (
  <svg className="h-4 w-4 sm:h-5 sm:w-5 xl:h-7 xl:w-7 shrink-0 text-white" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
      clipRule="evenodd"
    />
  </svg>
)

export function HeroContent() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold tracking-[-0.08em] text-white sm:text-4xl lg:text-6xl xl:text-7xl">
        Start your Atmos with <br/> Spatial Tone Lock
      </h1>
      <p className="mt-3 sm:mt-6 xl:mt-8 max-w-xs sm:max-w-xl xl:max-w-3xl text-xs sm:text-lg xl:text-2xl text-neutral-300">
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.
        Lorem ipsum dolor sit amet
      </p>
      <ul className="mt-4 sm:mt-8 xl:mt-10 space-y-1.5 sm:space-y-3 xl:space-y-4 text-xs sm:text-base xl:text-xl text-neutral-300">
        <li className="flex items-center gap-2 sm:gap-3">
          {checkIcon}
          Lorem ipsum dolor sit amet consectetur
        </li>
        <li className="flex items-center gap-2 sm:gap-3">
          {checkIcon}
          Quisquam quos voluptatum doloremque veritatis
        </li>
        <li className="flex items-center gap-2 sm:gap-3">
          {checkIcon}
          Adipisicing elit perspiciatis magni repellat
        </li>
      </ul>
    </>
  )
}
