import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom has no ResizeObserver; Headless UI's Listbox machine requires one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

// Mock Supabase client
vi.mock('@/lib/supabase/supabaseClient', () => ({
  createClient: vi.fn(),
}))
