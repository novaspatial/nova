import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ProjectFile, ProjectStatus } from '@/types/portal'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

vi.mock('@/components/portal/FileUploader', () => ({
  FileUploader: () => <div data-testid="file-uploader" />,
}))

import { PortalToastProvider } from './PortalToast'
import { ProjectProvider } from './ProjectContext'
import { UploadManager } from './UploadManager'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mixFile(name: string): ProjectFile {
  return {
    id: `file-${name}`,
    project_id: 'p1',
    file_name: name,
    file_size: 1024,
    mime_type: 'audio/x-wav',
    file_type: 'mix',
    storage_path: `p1/${name}`,
    upload_status: 'uploaded',
    uploaded_by: 'studio-user',
    created_at: '2026-07-31T00:00:00Z',
    upload_registered_at: '2026-07-31T00:00:00Z',
  }
}

function renderStudio(status: ProjectStatus, files: ProjectFile[]) {
  return render(
    <PortalToastProvider>
      <ProjectProvider
        value={{
          projectId: 'p1',
          projectTitle: 'Test Project',
          projectStatus: status,
          userRole: 'studio',
          isStudio: true,
        }}
      >
        <UploadManager existingFiles={files} isReadOnly={false} />
      </ProjectProvider>
    </PortalToastProvider>,
  )
}

beforeEach(() => {
  mockFetch.mockReset()
  mockRefresh.mockReset()
})

describe('UploadManager — studio handoff feedback', () => {
  test('confirming Send for Review toasts that the mixes went to the client', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'p1' }) })
    renderStudio('mixing', [mixFile('mix-v1.wav'), mixFile('mix-v2.wav')])

    fireEvent.click(screen.getByRole('button', { name: 'Send for Review' }))
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Send for Review',
      }),
    )

    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent('Mixes sent to the client')
    expect(toast).toHaveTextContent('2 mix files are now on the client')
    expect(toast).toHaveTextContent('a notification email should be on its way')
  })

  test('a failed send surfaces the error and toasts nothing', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Project status changed concurrently.' }),
    })
    renderStudio('mixing', [mixFile('mix-v1.wav')])

    fireEvent.click(screen.getByRole('button', { name: 'Send for Review' }))
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Send for Review',
      }),
    )

    await screen.findAllByText('Project status changed concurrently.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('once in review the studio sees a standing "sent to the client" banner', () => {
    renderStudio('review', [mixFile('mix-v1.wav')])

    expect(screen.getByText('Sent to the client')).toBeInTheDocument()
    expect(
      screen.getByText(/can play these mixes on their Listen tab/),
    ).toBeInTheDocument()
  })

  test('the banner explains the revision case in its own words', () => {
    renderStudio('revision', [mixFile('mix-v1.wav')])

    expect(screen.getByText('Sent to the client')).toBeInTheDocument()
    expect(screen.getByText(/asked for revisions/)).toBeInTheDocument()
  })

  test('no banner before anything has been sent', () => {
    renderStudio('mixing', [mixFile('mix-v1.wav')])

    expect(screen.queryByText('Sent to the client')).not.toBeInTheDocument()
  })
})
