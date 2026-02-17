const checkIcon = (
  <svg className="h-5 w-5 shrink-0 text-white" viewBox="0 0 20 20" fill="currentColor">
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
      <h1 className="font-display text-5xl font-medium tracking-tight text-balance text-white sm:text-7xl">
        Start your Atmos mix with Spatial Tone Lock
      </h1>
      <p className="mt-6 text-xl text-neutral-300">
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.
      </p>
      <ul className="mt-8 space-y-3 text-lg text-neutral-300">
        <li className="flex items-center gap-3">
          {checkIcon}
          Lorem ipsum dolor sit amet consectetur
        </li>
        <li className="flex items-center gap-3">
          {checkIcon}
          Quisquam quos voluptatum doloremque veritatis
        </li>
        <li className="flex items-center gap-3">
          {checkIcon}
          Adipisicing elit perspiciatis magni repellat
        </li>
      </ul>
    </>
  )
}
