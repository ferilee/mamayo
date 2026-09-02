import { describe, expect, it } from 'vitest'
import { cartTotal, formatRupiah, getSalesAnalytics, isValidWhatsapp, nextOrderStatus, normalizeWhatsapp } from './ordering'
import type { CartLine, MenuItem, Order } from './ordering'

const menuItem: MenuItem = {
  id: 'test', name: 'Menu test', description: '', price: 15000, category: 'utama', categoryLabel: 'Menu utama', image: '', available: true, rating: 4.8, reviewCount: 10,
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

  it('normalizes Indonesian WhatsApp formats for customer identity', () => {
    expect(normalizeWhatsapp('081234567890')).toBe('+6281234567890')
    expect(normalizeWhatsapp('+6281234567890')).toBe('+6281234567890')
    expect(isValidWhatsapp('081234567890')).toBe(true)
    expect(isValidWhatsapp('0211234')).toBe(false)
  })

  it('counts only completed orders in the selected calendar period', () => {
    const today = new Date(2026, 8, 2, 12)
    const makeOrder = (id: string, createdAt: string, status: 'completed' | 'pending', whatsapp: string, total: number): Order => ({
      id, code: id, createdAt, customerName: 'Test', whatsapp, pickupTime: '12.00', items: [{ itemId: 'test', name: 'Menu test', price: total, quantity: 1 }], subtotal: total, total, paymentMethod: 'cash', paymentStatus: 'not_required', status,
    })
    const orderAt = (hour: number) => new Date(2026, 8, 2, hour).toISOString()
    const analytics = getSalesAnalytics([
      makeOrder('today-1', orderAt(3), 'completed', '081234567890', 15000),
      makeOrder('today-2', orderAt(5), 'completed', '+6281234567890', 15000),
      makeOrder('today-3', orderAt(6), 'pending', '089999999999', 20000),
    ], 'daily', today)
    expect(analytics.completedOrders).toBe(2)
    expect(analytics.revenue).toBe(30000)
    expect(analytics.uniqueCustomers).toBe(1)
    expect(analytics.returningCustomers).toBe(1)
    expect(analytics.menuSales[0].quantity).toBe(2)
    expect(analytics.trend).toHaveLength(24)
    expect(analytics.trend.find((point) => point.label === '03.00')?.revenue).toBe(15000)
    expect(analytics.trend.find((point) => point.label === '05.00')?.revenue).toBe(15000)
  })
})
