import { FadeIn } from '@/components/ui/FadeIn'
import { NewProjectForm } from './NewProjectForm'

export const metadata = {
  title: 'New Project — Client Portal',
}

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <FadeIn>
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          Start a New Project
        </h1>
        <p className="mt-2 text-xs text-zinc-400 sm:text-sm">
          Upload your multitrack stems and reference to begin the Dolby Atmos
          mixing process.
        </p>
      </FadeIn>

      <FadeIn>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/2 p-4 shadow-2xl shadow-violet-500/5 backdrop-blur-sm sm:p-8">
          <NewProjectForm />
        </div>
      </FadeIn>
    </div>
  )
}
