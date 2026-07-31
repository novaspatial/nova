import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom has no ResizeObserver; Headless UI's Listbox machine requires one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

// jsdom has no IntersectionObserver; framer-motion's whileInView (FadeIn)
// requires one.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)

// Mock Supabase client
vi.mock('@/lib/supabase/supabaseClient', () => ({
  createClient: vi.fn(),
}))
