import { useEffect, useState } from 'react'
import { seedMenu, seedOrders, seedSettings } from '../data/seed'
import type { MenuItem, Order, StoreSettings } from './ordering'

const STORAGE_KEY = 'mamayo-kitchen-data'

export type AppData = { menu: MenuItem[]; orders: Order[]; settings: StoreSettings }

const initialData: AppData = { menu: seedMenu, orders: seedOrders, settings: seedSettings }

const hydrateMenu = (savedMenu: MenuItem[]) => savedMenu.map((item) => {
  const seedItem = seedMenu.find((seed) => seed.id === item.id)
  return { ...seedItem, ...item, rating: item.rating ?? seedItem?.rating ?? 0, reviewCount: item.reviewCount ?? seedItem?.reviewCount ?? 0 }
})

const loadData = (): AppData => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return initialData
    const parsed = JSON.parse(saved) as AppData
    return { ...initialData, ...parsed, menu: hydrateMenu(parsed.menu ?? seedMenu), orders: parsed.orders ?? seedOrders, settings: { ...seedSettings, ...parsed.settings } }
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
