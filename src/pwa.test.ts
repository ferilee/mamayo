// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readProjectFile = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')

describe('PWA public assets', () => {
  it('publishes favicon, manifest, and social metadata in the document head', () => {
    const html = readProjectFile('index.html')

    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
    expect(html).toContain('<meta property="og:title" content="Mamayo Kitchen — Masakan rumahan" />')
    expect(html).toContain('<meta property="og:image" content="/og-image.svg" />')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />')
  })

  it('defines an installable standalone manifest with both required icon sizes', () => {
    const manifest = JSON.parse(readProjectFile('public/manifest.webmanifest')) as {
      name: string
      display: string
      start_url: string
      icons: Array<{ src: string; sizes: string; type: string }>
    }

    expect(manifest.name).toBe('Mamayo Kitchen')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' }),
      expect.objectContaining({ src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' }),
    ]))
  })

  it('keeps the service worker shell cache separate from API requests', () => {
    const serviceWorker = readProjectFile('public/sw.js')

    expect(serviceWorker).toContain("const CACHE_NAME = 'mamayo-shell-v1'")
    expect(serviceWorker).toContain("new URL(request.url).pathname.startsWith('/api/')")
    expect(serviceWorker).toContain("caches.match(request).then((cached) => cached ?? caches.match('/')")
  })

  it('provides valid SVG assets for the favicon and share preview', () => {
    expect(readProjectFile('public/favicon.svg')).toMatch(/^<svg\b/)
    expect(readProjectFile('public/og-image.svg')).toContain('Mamayo Kitchen')
  })
})
