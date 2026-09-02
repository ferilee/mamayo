import { describe, expect, it } from 'vitest'
import { resolveTheme } from './theme'

describe('theme preference', () => {
  it('uses the saved theme over the system preference', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('follows the system only when there is no saved preference', () => {
    expect(resolveTheme(null, true)).toBe('dark')
    expect(resolveTheme(null, false)).toBe('light')
    expect(resolveTheme('unknown', true)).toBe('dark')
  })
})
