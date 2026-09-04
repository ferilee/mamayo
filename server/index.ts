import 'dotenv/config'
import { existsSync, mkdirSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import cors from 'cors'
import express from 'express'
import multer from 'multer'
import { createOrder, getAppData, updateMenu, updateOrder, updateSettings } from './db.js'
import { notifyTelegram } from './telegram.js'
import { isValidWhatsapp } from '../src/lib/ordering.js'
import type { CreateOrderInput, MenuUpdateInput, OrderStatus, PaymentStatus } from '../src/lib/ordering.js'

const app = express()
const port = Number(process.env.PORT ?? 3001)
const clients = new Set<express.Response>()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

const uploadDir = resolve(process.env.MAMAYO_UPLOAD_DIR ?? 'data/uploads')
mkdirSync(uploadDir, { recursive: true })
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_request, file, callback) => callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!file.mimetype.startsWith('image/')) { callback(new Error('Gambar harus berformat image.')); return }
    callback(null, true)
  },
})
app.use('/api/uploads', express.static(uploadDir))

const broadcast = (event: string) => {
  for (const client of clients) {
    client.write(`event: ${event}\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`)
  }
}

app.get('/api/health', (_request, response) => response.json({ ok: true }))
app.get('/api/bootstrap', (_request, response) => response.json(getAppData()))

app.post('/api/uploads', upload.single('image'), (request, response) => {
  if (!request.file) return response.status(400).json({ error: 'Pilih gambar menu terlebih dahulu.' })
  return response.status(201).json({ url: `/api/uploads/${request.file.filename}` })
})

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
  const body = request.body as MenuUpdateInput
  if (body.price !== undefined && (!Number.isInteger(body.price) || body.price < 0)) return response.status(400).json({ error: 'Harga tidak valid.' })
  if (body.available !== undefined && typeof body.available !== 'boolean') return response.status(400).json({ error: 'Ketersediaan menu tidak valid.' })
  const stringFields = ['name', 'description', 'category', 'categoryLabel', 'image'] as const
  if (stringFields.some((field) => body[field] !== undefined && typeof body[field] !== 'string')) return response.status(400).json({ error: 'Data menu tidak valid.' })
  try {
    const menu = updateMenu(request.params.id, body)
    if (!menu) return response.status(404).json({ error: 'Menu tidak ditemukan.' })
    broadcast('menu-updated')
    return response.json(menu)
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : 'Menu tidak dapat diperbarui.' })
  }
})

app.patch('/api/settings', (request, response) => {
  const body = request.body as { isOpen?: boolean }
  if (body.isOpen !== undefined && typeof body.isOpen !== 'boolean') return response.status(400).json({ error: 'Status warung tidak valid.' })
  const settings = updateSettings(body)
  broadcast('settings-updated')
  return response.json(settings)
})

const clientDist = resolve('dist')
if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.use((request, response, next) => {
    if (request.method === 'GET' && !request.path.startsWith('/api/')) {
      return response.sendFile(resolve(clientDist, 'index.html'))
    }
    return next()
  })
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return response.status(400).json({ error: 'Ukuran gambar maksimal 5 MB.' })
  if (error instanceof Error) return response.status(400).json({ error: error.message })
  return response.status(500).json({ error: 'Terjadi gangguan pada server.' })
})

app.listen(port, () => console.log(`Mamayo API running at http://localhost:${port}`))
