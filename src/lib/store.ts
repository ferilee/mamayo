import { useEffect, useState } from 'react'
import { seedMenu, seedOrders, seedSettings } from '../data/seed'
import type { MenuItem, Order, StoreSettings } from './ordering'

const STORAGE_KEY = 'mamayo-kitchen-data'

export type AppData = { menu: MenuItem[]; orders: Order[]; settings: StoreSettings }

const initialData: AppData = { menu: seedMenu, orders: seedOrders, settings: seedSettings }

const loadData = (): AppData => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) as AppData : initialData
  } catch {
    return initialData
  }
}

export const useStore = () => {
  const [data, setData] = useState<AppData>(loadData)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  return { data, setData }
}

export const resetStore = () => localStorage.removeItem(STORAGE_KEY)
