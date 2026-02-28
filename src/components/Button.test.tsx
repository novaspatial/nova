import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Button } from './Button'

test('Button renders with children', () => {
  render(<Button>Click me</Button>)
  const buttonElement = screen.getByRole('button', { name: /click me/i })
  expect(buttonElement).toBeDefined()
})

test('Button renders as a link when href is provided', () => {
  render(<Button href="/about">About Us</Button>)
  const linkElement = screen.getByRole('link', { name: /about us/i })
  expect(linkElement).toBeDefined()
  expect(linkElement.getAttribute('href')).toBe('/about')
})
