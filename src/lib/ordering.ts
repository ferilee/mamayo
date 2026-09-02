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

export type StoreSettings = {
  isOpen: boolean
  hours: string
  address: string
  paymentAccount: string
}

export const formatRupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)

export const cartTotal = (lines: CartLine[]) => lines.reduce((total, line) => total + line.item.price * line.quantity, 0)

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
