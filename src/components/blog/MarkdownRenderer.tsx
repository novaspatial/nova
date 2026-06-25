'use client'

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeUnwrapImages from 'rehype-unwrap-images'
import { isValidElement, type ReactElement } from 'react'

import { GrayscaleTransitionImage } from '@/components/ui/GrayscaleTransitionImage'
import { MDXComponents } from '@/components/ui/MDXComponents'

const TopTip = MDXComponents.TopTip
const AppleMusicCallout = MDXComponents.AppleMusicCallout

// Allow language-* classNames on <code> so we can detect the `top-tip` shortcode
// after rehype-sanitize runs (the default schema strips unknown attributes).
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...((defaultSchema.attributes?.code as unknown[]) ?? []),
      ['className', /^language-./],
    ],
  },
}

function extractText(node: unknown): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (isValidElement(node)) {
    const props = (node as ReactElement<{ children?: unknown }>).props
    return extractText(props.children)
  }
  return ''
}

const components: Components = {
  img({ src, alt }) {
    if (!src || typeof src !== 'string') return null
    return (
      <div className="group isolate my-10 overflow-hidden rounded-4xl bg-white/10 max-sm:-mx-6">
        <GrayscaleTransitionImage
          src={src}
          alt={alt ?? ''}
          width={1280}
          height={800}
          sizes="(min-width: 768px) 41.25rem, 100vw"
          className="aspect-16/10 w-full object-cover"
        />
      </div>
    )
  },
  pre({ children }) {
    if (isValidElement(children)) {
      const childProps = children.props as {
        className?: string
        children?: unknown
      }
      const className =
        typeof childProps.className === 'string' ? childProps.className : ''

      if (className.includes('language-apple-music')) {
        const text = extractText(childProps.children).replace(/\n$/, '')
        return <AppleMusicCallout>{text}</AppleMusicCallout>
      }
      if (className.includes('language-top-tip')) {
        const text = extractText(childProps.children).replace(/\n$/, '')
        return <TopTip>{text}</TopTip>
      }
    }
    return <pre>{children}</pre>
  },
}

export function MarkdownRenderer({ children }: { children: string }) {
  return (
    <div className="typography">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeUnwrapImages, [rehypeSanitize, sanitizeSchema]]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
