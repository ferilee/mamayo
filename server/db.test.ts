// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, expect, test } from 'vitest'

process.env.MAMAYO_DB_PATH = join(mkdtempSync(join(tmpdir(), 'mamayo-menu-')), 'test.sqlite')

const { db, getMenu, updateMenu } = await import('./db.js')

afterAll(() => db.close())

test('pemilik dapat memperbarui nama dan gambar menu', () => {
  const updates = { name: 'Nasi Goreng Uji', image: '/uploads/nasi-uji.jpg' } as Parameters<typeof updateMenu>[1]
  const updated = updateMenu('nasi-goreng-rendang', updates)

  expect(updated?.name).toBe('Nasi Goreng Uji')
  expect(updated?.image).toBe('/uploads/nasi-uji.jpg')
  expect(getMenu().find((item) => item.id === 'nasi-goreng-rendang')).toMatchObject(updates)
})
