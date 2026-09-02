export type OrderStatus = 'pending' | 'processing' | 'ready' | 'completed' | 'cancelled'
export type PaymentMethod = 'cash' | 'transfer'
export type PaymentStatus = 'not_required' | 'pending' | 'proof_submitted' | 'verified'

export type MenuItem = {
  id: string
  name: string
  description: string
  price: number
  category: string
  categoryLabel: string
  image: string
  available: boolean
  popular?: boolean
  rating: number
  reviewCount: number
}

export type CartLine = {
  item: MenuItem
  quantity: number
}

export type Order = {
  id: string
  code: string
  createdAt: string
  customerName: string
  whatsapp?: string
  pickupTime: string
  note?: string
  items: Array<{ itemId: string; name: string; price: number; quantity: number }>
  subtotal: number
  total: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  paymentProof?: string
  status: OrderStatus
}

export type CreateOrderInput = {
  customerName: string
  whatsapp: string
  pickupTime: string
  note?: string
  paymentMethod: PaymentMethod
  paymentProof?: string
  items: Array<{ itemId: string; quantity: number }>
}

export type StoreSettings = {
  isOpen: boolean
  hours: string
  address: string
  paymentAccount: string
}

export type ReportPeriod = 'daily' | 'weekly' | 'monthly'

export type MenuSalesStat = {
  itemId: string
  name: string
  quantity: number
  revenue: number
}

export type SalesAnalytics = {
  period: ReportPeriod
  revenue: number
  completedOrders: number
  uniqueCustomers: number
  returningCustomers: number
  newCustomers: number
  guestOrders: number
  repeatRate: number
  revenueChangePercent: number | null
  ordersChangePercent: number | null
  menuSales: MenuSalesStat[]
  trend: Array<{ label: string; revenue: number; orders: number }>
}

export const formatRupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)

export const cartTotal = (lines: CartLine[]) => lines.reduce((total, line) => total + line.item.price * line.quantity, 0)

export const normalizeWhatsapp = (value: string) => {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('62')) return `+${digits}`
  if (digits.startsWith('0')) return `+62${digits.slice(1)}`
  return `+62${digits}`
}

export const isValidWhatsapp = (value: string) => /^\+628\d{7,12}$/.test(normalizeWhatsapp(value))

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const periodBounds = (period: ReportPeriod, reference: Date) => {
  const day = startOfDay(reference)
  let start: Date
  if (period === 'monthly') start = new Date(day.getFullYear(), day.getMonth(), 1)
  else if (period === 'weekly') {
    const mondayOffset = (day.getDay() + 6) % 7
    start = new Date(day)
    start.setDate(start.getDate() - mondayOffset)
  } else start = day
  const previousStart = new Date(start)
  if (period === 'monthly') previousStart.setMonth(previousStart.getMonth() - 1)
  else previousStart.setDate(previousStart.getDate() - (period === 'weekly' ? 7 : 1))
  const end = period === 'monthly'
    ? new Date(start.getFullYear(), start.getMonth() + 1, 1)
    : period === 'weekly'
      ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
      : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
  return { start, end, previousStart }
}

const inRange = (date: Date, start: Date, end: Date) => date >= start && date < end

const percentChange = (current: number, previous: number) => previous === 0 ? (current === 0 ? 0 : null) : Math.round(((current - previous) / previous) * 100)

export const getSalesAnalytics = (orders: Order[], period: ReportPeriod, reference = new Date()): SalesAnalytics => {
  const bounds = periodBounds(period, reference)
  const completed = orders.filter((order) => order.status === 'completed')
  const currentOrders = completed.filter((order) => inRange(new Date(order.createdAt), bounds.start, bounds.end))
  const previousOrders = completed.filter((order) => inRange(new Date(order.createdAt), bounds.previousStart, bounds.start))
  const revenue = currentOrders.reduce((sum, order) => sum + order.total, 0)
  const previousRevenue = previousOrders.reduce((sum, order) => sum + order.total, 0)
  const currentCustomerCounts = new Map<string, number>()
  const firstCustomerOrder = new Map<string, number>()
  let guestOrders = 0
  for (const order of completed) {
    const customer = order.whatsapp ? normalizeWhatsapp(order.whatsapp) : ''
    const timestamp = new Date(order.createdAt).getTime()
    if (!customer) continue
    currentCustomerCounts.set(customer, currentCustomerCounts.get(customer) ?? 0)
    firstCustomerOrder.set(customer, Math.min(firstCustomerOrder.get(customer) ?? timestamp, timestamp))
  }
  for (const order of currentOrders) {
    const customer = order.whatsapp ? normalizeWhatsapp(order.whatsapp) : ''
    if (!customer) { guestOrders += 1; continue }
    currentCustomerCounts.set(customer, (currentCustomerCounts.get(customer) ?? 0) + 1)
  }
  const activeCustomers = [...currentCustomerCounts.entries()].filter(([, count]) => count > 0)
  const returningCustomers = activeCustomers.filter(([, count]) => count > 1).length
  const newCustomers = activeCustomers.filter(([customer]) => firstCustomerOrder.get(customer)! >= bounds.start.getTime()).length
  const trend: SalesAnalytics['trend'] = []
  if (period === 'daily') {
    for (let hour = 0; hour < 24; hour += 1) {
      const hourStart = new Date(bounds.start)
      hourStart.setHours(hour)
      const next = new Date(hourStart)
      next.setHours(next.getHours() + 1)
      const hourOrders = currentOrders.filter((order) => inRange(new Date(order.createdAt), hourStart, next))
      trend.push({ label: `${String(hour).padStart(2, '0')}.00`, revenue: hourOrders.reduce((sum, order) => sum + order.total, 0), orders: hourOrders.length })
    }
  } else {
    for (let cursor = new Date(bounds.start); cursor < bounds.end; cursor.setDate(cursor.getDate() + 1)) {
      const next = new Date(cursor)
      next.setDate(next.getDate() + 1)
      const dayOrders = currentOrders.filter((order) => inRange(new Date(order.createdAt), cursor, next))
      trend.push({ label: cursor.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), revenue: dayOrders.reduce((sum, order) => sum + order.total, 0), orders: dayOrders.length })
    }
  }
  const menuMap = new Map<string, MenuSalesStat>()
  for (const order of currentOrders) for (const item of order.items) {
    const existing = menuMap.get(item.itemId) ?? { itemId: item.itemId, name: item.name, quantity: 0, revenue: 0 }
    existing.quantity += item.quantity
    existing.revenue += item.price * item.quantity
    menuMap.set(item.itemId, existing)
  }
  const menuSales = [...menuMap.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
  const uniqueCustomers = activeCustomers.length
  return {
    period, revenue, completedOrders: currentOrders.length, uniqueCustomers, returningCustomers,
    newCustomers, guestOrders, repeatRate: uniqueCustomers ? Math.round((returningCustomers / uniqueCustomers) * 100) : 0,
    revenueChangePercent: percentChange(revenue, previousRevenue), ordersChangePercent: percentChange(currentOrders.length, previousOrders.length), menuSales, trend,
  }
}

export const nextOrderStatus: Record<OrderStatus, OrderStatus | null> = {
  pending: 'processing',
  processing: 'ready',
  ready: 'completed',
  completed: null,
  cancelled: null,
}

export const statusLabel: Record<OrderStatus, string> = {
  pending: 'Menunggu konfirmasi',
  processing: 'Sedang dimasak',
  ready: 'Siap diambil',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

export const paymentLabel: Record<PaymentMethod, string> = {
  cash: 'Tunai saat ambil',
  transfer: 'Transfer / QRIS',
}

export const createOrderCode = (date = new Date()) => {
  const prefix = date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }).replace('/', '')
  const suffix = Math.floor(100 + Math.random() * 900)
  return `MY-${prefix}-${suffix}`
}
