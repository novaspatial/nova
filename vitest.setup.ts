import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock Supabase client
vi.mock('@/lib/supabase/supabaseClient', () => ({
  createClient: vi.fn(),
}))
