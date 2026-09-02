import { describe, expect, it } from 'vitest'
import { cartTotal, formatRupiah, nextOrderStatus } from './ordering'
import type { CartLine, MenuItem } from './ordering'

const menuItem: MenuItem = {
  id: 'test', name: 'Menu test', description: '', price: 15000, category: 'utama', categoryLabel: 'Menu utama', image: '', available: true,
}

describe('ordering domain', () => {
  it('calculates the cart total from current quantities and item prices', () => {
    const lines: CartLine[] = [{ item: menuItem, quantity: 2 }, { item: { ...menuItem, id: 'drink', price: 8000 }, quantity: 1 }]
    expect(cartTotal(lines)).toBe(38000)
  })

  it('formats Indonesian currency without decimal fractions', () => {
    expect(formatRupiah(28000)).toContain('28.000')
  })

  it('moves active orders through the kitchen workflow', () => {
    expect(nextOrderStatus.pending).toBe('processing')
    expect(nextOrderStatus.processing).toBe('ready')
    expect(nextOrderStatus.ready).toBe('completed')
    expect(nextOrderStatus.completed).toBeNull()
    expect(nextOrderStatus.cancelled).toBeNull()
  })
})
