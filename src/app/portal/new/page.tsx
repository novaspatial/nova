import { FadeIn } from '@/components/ui/FadeIn'
import { parseNewProjectParams } from '@/lib/portal/newProjectParams'
import { NewProjectForm } from './NewProjectForm'

export const metadata = {
  title: 'New Project — Client Portal',
}

// searchParams carry the homepage calculator's deep link (#30); parsing
// happens here on the server so the client form needs no useSearchParams
// Suspense boundary. addOns is parsed but unused until #19 wires add-on
// purchases into the form.
export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const prefill = parseNewProjectParams(await searchParams)

  return (
    <div className="mx-auto max-w-2xl">
      <FadeIn>
        <NewProjectForm
          initialSongCount={prefill.songCount}
          initialCode={prefill.code}
        />
      </FadeIn>
    </div>
  )
}
