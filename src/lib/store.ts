import { useCallback, useEffect, useState } from 'react'
import { seedMenu, seedOrders, seedSettings } from '../data/seed'
import type { CreateOrderInput, MenuItem, Order, StoreSettings } from './ordering'

export type AppData = { menu: MenuItem[]; orders: Order[]; settings: StoreSettings }

const initialData: AppData = { menu: seedMenu, orders: seedOrders, settings: seedSettings }

const request = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, options)
  const payload = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Terjadi gangguan pada server.')
  return payload as T
}

export const useStore = () => {
  const [data, setData] = useState<AppData>(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const next = await request<AppData>('/api/bootstrap')
      setData(next)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Server belum terhubung.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const events = new EventSource('/api/events')
    const eventNames = ['order-created', 'order-updated', 'menu-updated', 'settings-updated']
    eventNames.forEach((eventName) => events.addEventListener(eventName, refresh))
    return () => {
      eventNames.forEach((eventName) => events.removeEventListener(eventName, refresh))
      events.close()
    }
  }, [refresh])

  const createOrder = useCallback(async (input: CreateOrderInput) => {
    const order = await request<Order>('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    setData((current) => ({ ...current, orders: [order, ...current.orders.filter((item) => item.id !== order.id)] }))
    return order
  }, [])

  const updateOrder = useCallback(async (id: string, updates: Partial<Pick<Order, 'status' | 'paymentStatus' | 'paymentProof'>>) => {
    const order = await request<Order>(`/api/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
    setData((current) => ({ ...current, orders: current.orders.map((item) => item.id === order.id ? order : item) }))
    return order
  }, [])

  const updateMenu = useCallback(async (id: string, updates: Partial<Pick<MenuItem, 'price' | 'available'>>) => {
    const menu = await request<MenuItem>(`/api/menu/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
    setData((current) => ({ ...current, menu: current.menu.map((item) => item.id === menu.id ? menu : item) }))
    return menu
  }, [])

  const updateSettings = useCallback(async (updates: Partial<StoreSettings>) => {
    const settings = await request<StoreSettings>('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
    setData((current) => ({ ...current, settings }))
    return settings
  }, [])

  return { data, loading, error, createOrder, updateOrder, updateMenu, updateSettings }
}
