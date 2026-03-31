'use client'

import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { FadeIn } from '@/components/ui/FadeIn'

function TextInput({
  label,
  ...props
}: React.ComponentPropsWithoutRef<'input'> & { label: string }) {
  const id = useId()

  return (
    <div className="group relative z-0 transition-all focus-within:z-10">
      <input
        type="text"
        id={id}
        {...props}
        placeholder=" "
        className="peer block w-full border border-white/20 bg-transparent px-6 pt-12 pb-4 text-base/6 text-white ring-4 ring-transparent transition group-first:rounded-t-2xl group-last:rounded-b-2xl focus:border-violet-400 focus:ring-violet-500/10 focus:outline-hidden"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-1/2 left-6 -mt-3 origin-left text-base/6 text-white transition-all duration-200 peer-not-placeholder-shown:-translate-y-4 peer-not-placeholder-shown:scale-75 peer-not-placeholder-shown:font-semibold peer-not-placeholder-shown:text-white peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:font-semibold peer-focus:text-white"
      >
        {label}
      </label>
    </div>
  )
}

function TextArea({
  label,
  ...props
}: React.ComponentPropsWithoutRef<'textarea'> & { label: string }) {
  const id = useId()

  return (
    <div className="group relative z-0 transition-all focus-within:z-10">
      <textarea
        id={id}
        {...props}
        placeholder=" "
        rows={4}
        className="peer block w-full border border-white/20 bg-transparent px-6 pt-12 pb-4 text-base/6 text-white ring-4 ring-transparent transition group-first:rounded-t-2xl group-last:rounded-b-2xl focus:border-violet-400 focus:ring-violet-500/10 focus:outline-hidden resize-y"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-6 left-6 -mt-3 origin-left text-base/6 text-white transition-all duration-200 peer-not-placeholder-shown:-translate-y-2 peer-not-placeholder-shown:scale-75 peer-not-placeholder-shown:font-semibold peer-not-placeholder-shown:text-white peer-focus:-translate-y-2 peer-focus:scale-75 peer-focus:font-semibold peer-focus:text-white"
      >
        {label}
      </label>
    </div>
  )
}

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMessage('')

    const form = e.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      subject: (form.elements.namedItem('subject') as HTMLInputElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Something went wrong.')
      }

      setStatus('success')
      form.reset()
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <FadeIn className="lg:order-last">
      <form onSubmit={handleSubmit}>
        <h2 className="font-display text-base font-semibold text-white">
          Contact Us
        </h2>
        <div className="isolate mt-6 -space-y-px rounded-2xl bg-violet-950/20 shadow-lg shadow-violet-500/20">
          <TextInput label="Name" name="name" autoComplete="name" required />
          <TextInput
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            required
          />
          <TextInput
            label="Subject"
            name="subject"
          />
          <TextArea label="Message" name="message" required />
        </div>
        <Button
          type="submit"
          disabled={status === 'submitting'}
          className="mt-10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'submitting' ? 'Sending...' : 'Send message'}
        </Button>
        {status === 'success' && (
          <p className="mt-4 text-sm text-green-400">
            Thank you! We&apos;ll be in touch soon.
          </p>
        )}
        {status === 'error' && (
          <p className="mt-4 text-sm text-red-400">{errorMessage}</p>
        )}
      </form>
    </FadeIn>
  )
}
