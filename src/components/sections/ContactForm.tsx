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

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [hasInput, setHasInput] = useState(false)
  const messageId = useId()

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
      setHasInput(false)
      form.reset()
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  function handleFormChange(e: React.ChangeEvent<HTMLFormElement>) {
    const els = Array.from(e.currentTarget.elements) as Array<HTMLInputElement | HTMLTextAreaElement>
    setHasInput(els.some((el) => el.value.trim() !== ''))
  }

  return (
    <FadeIn className="lg:order-last">
      <form onSubmit={handleSubmit} onChange={handleFormChange}>
        <h2 className="font-display text-base font-semibold text-white">
          Contact Us
        </h2>
        <div className="isolate mt-6 -space-y-px rounded-2xl bg-black/40 shadow-lg shadow-violet-500/20">
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
          {/* Message field with send button embedded inside */}
          <div className="group relative z-0 transition-all focus-within:z-10">
            <div className="group-last:rounded-b-2xl overflow-hidden border border-white/20 ring-4 ring-transparent transition focus-within:border-violet-400 focus-within:ring-violet-500/10">
              <div className="relative">
                <textarea
                  id={messageId}
                  name="message"
                  required
                  placeholder=" "
                  rows={5}
                  className="peer block w-full bg-transparent px-6 pt-12 pb-4 text-base/6 text-white resize-none focus:outline-none"
                />
                <label
                  htmlFor={messageId}
                  className="pointer-events-none absolute top-6 left-6 -mt-3 origin-left text-base/6 text-white transition-all duration-200 peer-not-placeholder-shown:-translate-y-2 peer-not-placeholder-shown:scale-75 peer-not-placeholder-shown:font-semibold peer-not-placeholder-shown:text-white peer-focus:-translate-y-2 peer-focus:scale-75 peer-focus:font-semibold peer-focus:text-white"
                >
                  Message
                </label>
              </div>
              <div className={`flex items-center gap-3 border-t border-white/10 px-4 overflow-hidden transition-all duration-300 ${hasInput ? 'py-3 max-h-20 opacity-100' : 'max-h-0 opacity-0 border-t-0'}`}>
                {status === 'success' && (
                  <span className="mr-auto text-sm text-emerald-300">
                    Thank you! We&apos;ll be in touch soon.
                  </span>
                )}
                {status === 'error' && (
                  <span className="mr-auto text-sm text-red-300">{errorMessage}</span>
                )}
                <Button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="ml-auto shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'submitting' ? 'Sending...' : 'Send message'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </FadeIn>
  )
}
