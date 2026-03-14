import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsModal } from '../components/SettingsModal'

beforeEach(() => {
  localStorage.clear()
})

describe('SettingsModal', () => {
  it('renders font family and font size inputs', () => {
    render(<SettingsModal open={true} onClose={() => {}} onSave={() => {}} />)
    expect(screen.getByLabelText('Font Family')).toBeDefined()
    expect(screen.getByLabelText('Font Size')).toBeDefined()
  })

  it('loads saved font size from localStorage', () => {
    localStorage.setItem('beads-board-terminal-font-size', '18')
    render(<SettingsModal open={true} onClose={() => {}} onSave={() => {}} />)
    const input = screen.getByLabelText('Font Size') as HTMLInputElement
    expect(input.value).toBe('18')
  })

  it('defaults font size to 13 when no saved value', () => {
    render(<SettingsModal open={true} onClose={() => {}} onSave={() => {}} />)
    const input = screen.getByLabelText('Font Size') as HTMLInputElement
    expect(input.value).toBe('13')
  })

  it('calls onSave with fontFamily and fontSize', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<SettingsModal open={true} onClose={onClose} onSave={onSave} />)

    const fontSizeInput = screen.getByLabelText('Font Size') as HTMLInputElement
    fireEvent.change(fontSizeInput, { target: { value: '16' } })

    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)

    expect(onSave).toHaveBeenCalledWith({ fontFamily: '', fontSize: 16 })
    expect(onClose).toHaveBeenCalled()
  })

  it('persists font size to localStorage on save', () => {
    render(<SettingsModal open={true} onClose={() => {}} onSave={() => {}} />)

    const fontSizeInput = screen.getByLabelText('Font Size') as HTMLInputElement
    fireEvent.change(fontSizeInput, { target: { value: '20' } })

    fireEvent.click(screen.getByText('Save'))

    expect(localStorage.getItem('beads-board-terminal-font-size')).toBe('20')
  })
})
