import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, test } from 'vitest'
import { NumberInput } from '@/components/ui/NumberInput'

function Harness({ initial = '', max }: { initial?: string; max?: number }) {
  const [value, setValue] = useState(initial)
  return (
    <NumberInput
      id="n"
      label="percent off"
      min={1}
      max={max}
      value={value}
      onChange={setValue}
    />
  )
}

describe('NumberInput stepper', () => {
  test('decrease from 5 goes to 4', () => {
    render(<Harness initial="5" />)
    fireEvent.click(screen.getByRole('button', { name: 'Decrease percent off' }))
    expect(screen.getByRole('spinbutton')).toHaveValue(4)
  })

  test('increase from empty goes to 1, then decrease disabled at min', () => {
    render(<Harness />)
    const inc = screen.getByRole('button', { name: 'Increase percent off' })
    const dec = screen.getByRole('button', { name: 'Decrease percent off' })
    expect(dec).toBeDisabled()
    fireEvent.click(inc)
    expect(screen.getByRole('spinbutton')).toHaveValue(1)
    fireEvent.click(inc)
    expect(screen.getByRole('spinbutton')).toHaveValue(2)
    fireEvent.click(dec)
    expect(screen.getByRole('spinbutton')).toHaveValue(1)
  })

  test('increase respects max', () => {
    render(<Harness initial="100" max={100} />)
    expect(
      screen.getByRole('button', { name: 'Increase percent off' }),
    ).toBeDisabled()
  })
})
