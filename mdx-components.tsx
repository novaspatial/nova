import { type MDXComponents as MDXComponentsType } from 'mdx/types'

import { MDXComponents } from '@/components/ui/MDXComponents'

export function useMDXComponents(components: MDXComponentsType) {
  return {
    ...components,
    ...MDXComponents,
  }
}
