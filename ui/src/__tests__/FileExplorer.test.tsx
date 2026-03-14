import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { FileExplorer } from '@/components/FileExplorer'

// Track fetch calls
let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([
      { name: 'src', type: 'directory', path: 'src' },
      { name: '.gitignore', type: 'file', path: '.gitignore' },
      { name: 'README.md', type: 'file', path: 'README.md' },
    ]),
  } as Response)
})

afterEach(() => {
  fetchSpy.mockRestore()
})

describe('FileExplorer', () => {
  it('fetches files without showDotfiles param (server handles dotfile visibility)', async () => {
    render(<FileExplorer />)
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).not.toContain('showDotfiles')
  })

  it('renders file entries including dotfiles from the API response', async () => {
    render(<FileExplorer />)
    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument()
      expect(screen.getByText('.gitignore')).toBeInTheDocument()
      expect(screen.getByText('README.md')).toBeInTheDocument()
    })
  })
})
