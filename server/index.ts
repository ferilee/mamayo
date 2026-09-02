import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createOrder, getAppData, getOrder, updateMenu, updateOrder, updateSettings } from './db.js'
import { notifyTelegram } from './telegram.js'
import { isValidWhatsapp } from '../src/lib/ordering.js'
import type { CreateOrderInput, OrderStatus, PaymentStatus } from '../src/lib/ordering.js'

const app = express()
const port = Number(process.env.PORT ?? 3001)
const clients = new Set<express.Response>()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

const broadcast = (event: string) => {
  for (const client of clients) {
    client.write(`event: ${event}\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`)
  }
}

app.get('/api/health', (_request, response) => response.json({ ok: true }))
app.get('/api/bootstrap', (_request, response) => response.json(getAppData()))

app.get('/api/events', (request, response) => {
  response.setHeader('Content-Type', 'text/event-stream')
  response.setHeader('Cache-Control', 'no-cache')
  response.setHeader('Connection', 'keep-alive')
  response.flushHeaders()
  response.write(`event: connected\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`)
  clients.add(response)
  const keepAlive = setInterval(() => response.write(': keep-alive\n\n'), 20000)
  request.on('close', () => { clearInterval(keepAlive); clients.delete(response) })
})

app.post('/api/orders', async (request, response) => {
  try {
    const input = request.body as CreateOrderInput
    if (!input.customerName?.trim() || !isValidWhatsapp(input.whatsapp)) return response.status(400).json({ error: 'Nama dan nomor WhatsApp yang valid wajib diisi.' })
    const order = createOrder(input)
    broadcast('order-created')
    void notifyTelegram(order, 'new')
    return response.status(201).json(order)
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : 'Pesanan tidak dapat dibuat.' })
  }
})

app.patch('/api/orders/:id', async (request, response) => {
  const body = request.body as { status?: OrderStatus; paymentStatus?: PaymentStatus; paymentProof?: string }
  const allowedStatus = ['pending', 'processing', 'ready', 'completed', 'cancelled']
  const allowedPayment = ['not_required', 'pending', 'proof_submitted', 'verified']
  if ((body.status && !allowedStatus.includes(body.status)) || (body.paymentStatus && !allowedPayment.includes(body.paymentStatus))) return response.status(400).json({ error: 'Status tidak valid.' })
  const order = updateOrder(request.params.id, body)
  if (!order) return response.status(404).json({ error: 'Pesanan tidak ditemukan.' })
  broadcast('order-updated')
  void notifyTelegram(order, 'status')
  return response.json(order)
})

app.patch('/api/menu/:id', (request, response) => {
  const body = request.body as { price?: number; available?: boolean }
  if (body.price !== undefined && (!Number.isFinite(body.price) || body.price < 0)) return response.status(400).json({ error: 'Harga tidak valid.' })
  const menu = updateMenu(request.params.id, body)
  if (!menu) return response.status(404).json({ error: 'Menu tidak ditemukan.' })
  broadcast('menu-updated')
  return response.json(menu)
})

app.patch('/api/settings', (request, response) => {
  const body = request.body as { isOpen?: boolean }
  if (body.isOpen !== undefined && typeof body.isOpen !== 'boolean') return response.status(400).json({ error: 'Status warung tidak valid.' })
  const settings = updateSettings(body)
  broadcast('settings-updated')
  return response.json(settings)
})

app.listen(port, () => console.log(`Mamayo API running at http://localhost:${port}`))
