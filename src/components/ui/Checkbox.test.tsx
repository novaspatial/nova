import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  test('renders an unchecked, accessible checkbox with its label', () => {
    render(<Checkbox>I agree</Checkbox>)
    const checkbox = screen.getByRole('checkbox', { name: 'I agree' })
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).not.toBeChecked()
  })

  test('toggles via keyboard-accessible native input when clicked (uncontrolled)', () => {
    render(<Checkbox>I agree</Checkbox>)
    const checkbox = screen.getByRole('checkbox', { name: 'I agree' })
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  test('reflects controlled selection and reports changes', () => {
    const onChange = vi.fn()
    render(
      <Checkbox isSelected onChange={onChange}>
        I agree
      </Checkbox>,
    )
    const checkbox = screen.getByRole('checkbox', { name: 'I agree' })
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  test('respects isDisabled', () => {
    render(<Checkbox isDisabled>I agree</Checkbox>)
    expect(screen.getByRole('checkbox', { name: 'I agree' })).toBeDisabled()
  })
})
