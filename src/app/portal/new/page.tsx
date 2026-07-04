import { FadeIn } from '@/components/ui/FadeIn'
import { NewProjectForm } from './NewProjectForm'

export const metadata = {
  title: 'New Project — Client Portal',
}

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <FadeIn>
        <NewProjectForm />
      </FadeIn>
    </div>
  )
}
