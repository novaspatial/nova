import { Container } from '@/components/Container'

export default function Loading() {
  return (
    <Container className="pt-24 sm:pt-32 lg:pt-40">
      <div className="mx-auto max-w-2xl lg:max-w-none">
        <div className="flex animate-pulse flex-col gap-6">
          <div className="h-10 w-2/3 rounded-lg bg-zinc-800" />
          <div className="h-4 w-full rounded-lg bg-zinc-800" />
          <div className="h-4 w-5/6 rounded-lg bg-zinc-800" />
          <div className="h-4 w-4/6 rounded-lg bg-zinc-800" />
          <div className="mt-8 h-48 w-full rounded-2xl bg-zinc-800" />
        </div>
      </div>
    </Container>
  )
}
