import type { Order } from '../src/lib/ordering.js'

const token = process.env.TELEGRAM_BOT_TOKEN
const chatId = process.env.TELEGRAM_CHAT_ID
const dashboardUrl = process.env.MAMAYO_DASHBOARD_URL ?? 'http://localhost:5173'

const formatOrder = (order: Order, heading: string) => [
  heading,
  '',
  `Kode: ${order.code}`,
  `Pelanggan: ${order.customerName}`,
  `Total: Rp${order.total.toLocaleString('id-ID')}`,
  `Ambil: ${order.pickupTime}`,
  `Bayar: ${order.paymentMethod === 'cash' ? 'Tunai saat ambil' : 'Transfer / QRIS'}`,
  '',
  `${dashboardUrl}/?order=${encodeURIComponent(order.code)}`,
].join('\n')

export const notifyTelegram = async (order: Order, event: 'new' | 'status') => {
  if (!token || !chatId) return
  const heading = event === 'new' ? '🔔 Pesanan baru di Mamayo Kitchen' : `📌 Status pesanan ${order.code}: ${order.status}`
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: formatOrder(order, heading), disable_web_page_preview: true }),
    })
    if (!response.ok) console.error(`[telegram] notification failed: ${response.status}`)
  } catch (error) {
    console.error('[telegram] notification failed:', error instanceof Error ? error.message : error)
  }
}
