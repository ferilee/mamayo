import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { seedMenu, seedOrders, seedSettings } from '../src/data/seed.js'
import { normalizeWhatsapp } from '../src/lib/ordering.js'
import type { CreateOrderInput, MenuItem, MenuUpdateInput, Order, OrderStatus, PaymentStatus, StoreSettings } from '../src/lib/ordering.js'

const databasePath = resolve(process.env.MAMAYO_DB_PATH ?? 'data/mamayo.sqlite')
mkdirSync(dirname(databasePath), { recursive: true })

export const db = new Database(databasePath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.exec(`
  CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    category TEXT NOT NULL,
    category_label TEXT NOT NULL,
    image TEXT NOT NULL,
    available INTEGER NOT NULL DEFAULT 1,
    popular INTEGER NOT NULL DEFAULT 0,
    rating REAL NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    pickup_time TEXT NOT NULL,
    note TEXT,
    subtotal INTEGER NOT NULL,
    total INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    payment_proof TEXT,
    status TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0)
  );
  CREATE TABLE IF NOT EXISTS store_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

const menuFromRow = (row: Record<string, unknown>): MenuItem => ({
  id: String(row.id), name: String(row.name), description: String(row.description), price: Number(row.price),
  category: String(row.category), categoryLabel: String(row.category_label), image: String(row.image),
  available: Boolean(row.available), popular: Boolean(row.popular), rating: Number(row.rating), reviewCount: Number(row.review_count),
})

const orderFromRow = (row: Record<string, unknown>): Order => ({
  id: String(row.id), code: String(row.code), createdAt: String(row.created_at), customerName: String(row.customer_name),
  whatsapp: String(row.whatsapp), pickupTime: String(row.pickup_time), note: row.note ? String(row.note) : undefined,
  items: (db.prepare('SELECT item_id, name, price, quantity FROM order_items WHERE order_id = ? ORDER BY id').all(row.id) as Record<string, unknown>[]).map((item) => ({
    itemId: String(item.item_id), name: String(item.name), price: Number(item.price), quantity: Number(item.quantity),
  })),
  subtotal: Number(row.subtotal), total: Number(row.total), paymentMethod: row.payment_method as Order['paymentMethod'],
  paymentStatus: row.payment_status as Order['paymentStatus'], paymentProof: row.payment_proof ? String(row.payment_proof) : undefined,
  status: row.status as OrderStatus,
})

const seedDatabase = () => {
  const menuCount = (db.prepare('SELECT COUNT(*) AS count FROM menu_items').get() as { count: number }).count
  if (menuCount === 0) {
    const insert = db.prepare(`INSERT INTO menu_items (id, name, description, price, category, category_label, image, available, popular, rating, review_count) VALUES (@id, @name, @description, @price, @category, @categoryLabel, @image, @available, @popular, @rating, @reviewCount)`)
    const insertMany = db.transaction((items: MenuItem[]) => items.forEach((item) => insert.run({ ...item, available: item.available ? 1 : 0, popular: item.popular ? 1 : 0 })))
    insertMany(seedMenu)
  }
  const orderCount = (db.prepare('SELECT COUNT(*) AS count FROM orders').get() as { count: number }).count
  if (orderCount === 0) {
    const insertOrder = db.prepare(`INSERT INTO orders (id, code, created_at, customer_name, whatsapp, pickup_time, note, subtotal, total, payment_method, payment_status, payment_proof, status) VALUES (@id, @code, @createdAt, @customerName, @whatsapp, @pickupTime, @note, @subtotal, @total, @paymentMethod, @paymentStatus, @paymentProof, @status)`)
    const insertItem = db.prepare('INSERT INTO order_items (order_id, item_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)')
    const insertMany = db.transaction((orders: Order[]) => orders.forEach((order) => {
      insertOrder.run({ ...order, paymentProof: order.paymentProof ?? null })
      order.items.forEach((item) => insertItem.run(order.id, item.itemId, item.name, item.price, item.quantity))
    }))
    insertMany(seedOrders)
  }
  const settingCount = (db.prepare('SELECT COUNT(*) AS count FROM store_settings').get() as { count: number }).count
  if (settingCount === 0) {
    const insert = db.prepare('INSERT INTO store_settings (key, value) VALUES (?, ?)')
    insert.run('isOpen', seedSettings.isOpen ? 'true' : 'false')
    insert.run('hours', seedSettings.hours)
    insert.run('address', seedSettings.address)
    insert.run('paymentAccount', seedSettings.paymentAccount)
  }
}
seedDatabase()

export const getMenu = () => (db.prepare('SELECT * FROM menu_items ORDER BY popular DESC, id').all() as Record<string, unknown>[]).map(menuFromRow)

export const getOrders = () => (db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as Record<string, unknown>[]).map(orderFromRow)

export const getOrder = (id: string) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? orderFromRow(row) : undefined
}

export const getSettings = (): StoreSettings => {
  const rows = db.prepare('SELECT key, value FROM store_settings').all() as Array<{ key: string; value: string }>
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]))
  return { isOpen: values.isOpen !== 'false', hours: values.hours ?? seedSettings.hours, address: values.address ?? seedSettings.address, paymentAccount: values.paymentAccount ?? seedSettings.paymentAccount }
}

export const getAppData = () => ({ menu: getMenu(), orders: getOrders(), settings: getSettings() })

export const createOrder = (input: CreateOrderInput): Order => {
  const menuLookup = db.prepare('SELECT * FROM menu_items WHERE id = ?')
  const lines = input.items.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new Error('Jumlah item tidak valid.')
    const menu = menuLookup.get(line.itemId) as Record<string, unknown> | undefined
    if (!menu) throw new Error('Menu tidak ditemukan.')
    if (!menu.available) throw new Error(`${String(menu.name)} sedang habis.`)
    return { menu: menuFromRow(menu), quantity: line.quantity }
  })
  if (lines.length === 0) throw new Error('Keranjang tidak boleh kosong.')
  const subtotal = lines.reduce((sum, line) => sum + line.menu.price * line.quantity, 0)
  const id = randomUUID()
  const code = `MY-${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }).replace('/', '')}-${Math.floor(100 + Math.random() * 900)}`
  const paymentStatus = input.paymentMethod === 'cash' ? 'not_required' : input.paymentProof ? 'proof_submitted' : 'pending'
  const insertOrder = db.prepare(`INSERT INTO orders (id, code, created_at, customer_name, whatsapp, pickup_time, note, subtotal, total, payment_method, payment_status, payment_proof, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertItem = db.prepare('INSERT INTO order_items (order_id, item_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)')
  const transaction = db.transaction(() => {
    insertOrder.run(id, code, new Date().toISOString(), input.customerName.trim(), normalizeWhatsapp(input.whatsapp), input.pickupTime, input.note?.trim() || null, subtotal, subtotal, input.paymentMethod, paymentStatus, input.paymentProof ?? null, 'pending')
    lines.forEach(({ menu, quantity }) => insertItem.run(id, menu.id, menu.name, menu.price, quantity))
  })
  transaction()
  return getOrder(id)!
}

export const updateOrder = (id: string, updates: { status?: OrderStatus; paymentStatus?: PaymentStatus; paymentProof?: string }) => {
  const current = getOrder(id)
  if (!current) return undefined
  const status = updates.status ?? current.status
  const paymentStatus = updates.paymentStatus ?? current.paymentStatus
  const paymentProof = updates.paymentProof ?? current.paymentProof ?? null
  db.prepare('UPDATE orders SET status = ?, payment_status = ?, payment_proof = ? WHERE id = ?').run(status, paymentStatus, paymentProof, id)
  return getOrder(id)
}

export const updateMenu = (id: string, updates: MenuUpdateInput) => {
  const current = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!current) return undefined
  const name = updates.name === undefined ? String(current.name) : updates.name.trim()
  const description = updates.description === undefined ? String(current.description) : updates.description.trim()
  const category = updates.category === undefined ? String(current.category) : updates.category.trim()
  const categoryLabel = updates.categoryLabel === undefined ? String(current.category_label) : updates.categoryLabel.trim()
  const image = updates.image === undefined ? String(current.image) : updates.image.trim()
  if (!name || !description || !category || !categoryLabel || !image) throw new Error('Nama, deskripsi, kategori, dan gambar menu wajib diisi.')
  db.prepare('UPDATE menu_items SET name = ?, description = ?, price = ?, category = ?, category_label = ?, image = ?, available = ? WHERE id = ?').run(name, description, updates.price ?? Number(current.price), category, categoryLabel, image, updates.available === undefined ? Number(current.available) : updates.available ? 1 : 0, id)
  return menuFromRow(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id) as Record<string, unknown>)
}

export const updateSettings = (updates: Partial<StoreSettings>) => {
  const next = { ...getSettings(), ...updates }
  const statement = db.prepare('INSERT INTO store_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  const transaction = db.transaction(() => Object.entries(next).forEach(([key, value]) => statement.run(key, String(value))))
  transaction()
  return next
}
