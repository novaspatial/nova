'use client'

import { useEffect } from 'react'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/Button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <Container className="flex h-full items-center pt-24 sm:pt-32 lg:pt-40">
      <div className="flex w-full flex-col items-center text-center">
        <p className="font-display text-4xl font-semibold text-white sm:text-5xl">
          Oops!
        </p>
        <h1 className="mt-4 font-display text-2xl font-semibold text-white">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          An unexpected error has occurred while trying to process your request.
        </p>
        <div className="mt-8 flex gap-4">
          <Button onClick={() => reset()}>Try again</Button>
          <Button href="/" invert>
            Go home
          </Button>
        </div>
      </div>
    </Container>
  )
}
