import { useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, AtSign, Check, Clock3, House, MapPin, Minus,
  ClipboardList,
  Moon, Plus, Search, ShoppingBag, Sparkles, Store, Sun,
} from 'lucide-react'
import { useTheme } from './lib/theme'
import { useStore } from './lib/store'
import {
  cartTotal, createOrderCode, formatRupiah, getSalesAnalytics, isValidWhatsapp, nextOrderStatus, normalizeWhatsapp, paymentLabel, statusLabel,
} from './lib/ordering'
import type { CartLine, MenuItem, Order, OrderStatus, PaymentMethod, ReportPeriod } from './lib/ordering'

type View = 'shop' | 'checkout' | 'success' | 'status' | 'admin'

const categories = [
  { id: 'semua', label: 'Semua menu' },
  { id: 'utama', label: 'Menu utama' },
  { id: 'camilan', label: 'Camilan' },
  { id: 'minuman', label: 'Minuman' },
]

function App() {
  const { data, setData } = useStore()
  const { theme, toggleTheme } = useTheme()
  const [view, setView] = useState<View>('shop')
  const [activeCategory, setActiveCategory] = useState('semua')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [notice, setNotice] = useState('')

  const visibleMenu = useMemo(() => data.menu.filter((item) => {
    const matchesCategory = activeCategory === 'semua' || item.category === activeCategory
    const search = `${item.name} ${item.description}`.toLowerCase()
    return matchesCategory && search.includes(query.toLowerCase())
  }), [activeCategory, data.menu, query])

  const addToCart = (item: MenuItem) => {
    if (!item.available) return
    setCart((current) => {
      const found = current.find((line) => line.item.id === item.id)
      return found
        ? current.map((line) => line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { item, quantity: 1 }]
    })
    setNotice(`${item.name} masuk ke keranjang`)
    window.setTimeout(() => setNotice(''), 2200)
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart((current) => current.flatMap((line) => {
      if (line.item.id !== id) return [line]
      const quantity = line.quantity + delta
      return quantity > 0 ? [{ ...line, quantity }] : []
    }))
  }

  const submitOrder = (form: { name: string; whatsapp: string; pickup: string; note: string; payment: PaymentMethod; paymentProof?: string }) => {
    const total = cartTotal(cart)
    const order: Order = {
      id: crypto.randomUUID(),
      code: createOrderCode(),
      createdAt: new Date().toISOString(),
      customerName: form.name,
      whatsapp: normalizeWhatsapp(form.whatsapp),
      pickupTime: form.pickup,
      note: form.note || undefined,
      items: cart.map(({ item, quantity }) => ({ itemId: item.id, name: item.name, price: item.price, quantity })),
      subtotal: total,
      total,
      paymentMethod: form.payment,
      paymentStatus: form.payment === 'cash' ? 'not_required' : form.paymentProof ? 'proof_submitted' : 'pending',
      paymentProof: form.paymentProof,
      status: 'pending',
    }
    setData((current) => ({ ...current, orders: [order, ...current.orders] }))
    setSelectedOrder(order)
    setCart([])
    setView('success')
  }

  const openOrderStatus = (order: Order) => {
    setSelectedOrder(order)
    setView('status')
  }

  const updateOrder = (orderId: string, updates: Partial<Order>) => {
    setData((current) => ({ ...current, orders: current.orders.map((order) => order.id === orderId ? { ...order, ...updates } : order) }))
    setSelectedOrder((current) => current && current.id === orderId ? { ...current, ...updates } : current)
  }

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <div className="app-shell">
      <Header view={view} theme={theme} cartCount={cartCount} onToggleTheme={toggleTheme} onShop={() => setView('shop')} onAdmin={() => setView('admin')} onOrders={() => data.orders[0] ? openOrderStatus(data.orders[0]) : setView('shop')} onCart={() => setView('checkout')} />
      <MobileBottomNav view={view} cartCount={cartCount} onShop={() => setView('shop')} onOrders={() => data.orders[0] ? openOrderStatus(data.orders[0]) : setView('shop')} onCart={() => setView('checkout')} onAdmin={() => setView('admin')} />
      {view === 'shop' && <Shop menu={visibleMenu} query={query} category={activeCategory} storeOpen={data.settings.isOpen} onQuery={setQuery} onCategory={setActiveCategory} onAdd={addToCart} onCart={() => setView('checkout')} onStatus={openOrderStatus} orders={data.orders} />}
      {view === 'checkout' && <Checkout cart={cart} storeOpen={data.settings.isOpen} onBack={() => setView('shop')} onUpdate={updateQuantity} onSubmit={submitOrder} />}
      {view === 'success' && selectedOrder && <Success order={selectedOrder} onStatus={() => setView('status')} onShop={() => setView('shop')} />}
      {view === 'status' && selectedOrder && <Status order={selectedOrder} onBack={() => setView('shop')} />}
      {view === 'admin' && <Admin data={data} onData={setData} onBack={() => setView('shop')} />}
      {notice && <div className="toast"><Check size={16} /> {notice}</div>}
    </div>
  )
}

function Header({ view, theme, cartCount, onToggleTheme, onShop, onAdmin, onOrders, onCart }: { view: View; theme: 'light' | 'dark'; cartCount: number; onToggleTheme: () => void; onShop: () => void; onAdmin: () => void; onOrders: () => void; onCart: () => void }) {
  return <header className="topbar">
    <button className="brand" onClick={onShop} aria-label="Kembali ke katalog">
      <span className="brand-mark">M</span><span><strong>Mamayo</strong><small>Kitchen</small></span>
    </button>
    <nav className="main-nav" aria-label="Navigasi utama">
      <button className={view !== 'admin' ? 'active' : ''} onClick={onShop}>Menu</button>
      <button onClick={onOrders} className={view === 'status' ? 'active' : ''}>Pesanan saya</button>
    </nav>
    <div className="header-actions">
      <button className="theme-toggle" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'} title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
      <button className="icon-button cart-button" onClick={onCart} aria-label="Buka keranjang"><ShoppingBag size={19} />{cartCount > 0 && <span>{cartCount}</span>}</button>
      <button className="owner-link" onClick={onAdmin}><Store size={16} /> <span>Area pemilik</span></button>
    </div>
  </header>
}

function MobileBottomNav({ view, cartCount, onShop, onOrders, onCart, onAdmin }: { view: View; cartCount: number; onShop: () => void; onOrders: () => void; onCart: () => void; onAdmin: () => void }) {
  return <nav className="mobile-bottom-nav" aria-label="Navigasi mobile">
    <button className={view === 'shop' ? 'active' : ''} onClick={onShop}><span className="mobile-nav-icon"><House size={18} /></span><span>Menu</span></button>
    <button className={view === 'status' || view === 'success' ? 'active' : ''} onClick={onOrders}><span className="mobile-nav-icon"><ClipboardList size={18} /></span><span>Pesanan</span></button>
    <button className={view === 'checkout' ? 'active' : ''} onClick={onCart}><span className="mobile-nav-icon nav-bag"><ShoppingBag size={18} />{cartCount > 0 && <b>{cartCount}</b>}</span><span>Keranjang</span></button>
    <button className={view === 'admin' ? 'active' : ''} onClick={onAdmin}><span className="mobile-nav-icon"><Store size={18} /></span><span>Pemilik</span></button>
  </nav>
}

function Shop({ menu, query, category, storeOpen, onQuery, onCategory, onAdd, onCart, onStatus, orders }: { menu: MenuItem[]; query: string; category: string; storeOpen: boolean; onQuery: (value: string) => void; onCategory: (value: string) => void; onAdd: (item: MenuItem) => void; onCart: () => void; onStatus: (order: Order) => void; orders: Order[] }) {
  return <main>
    <section className="hero page-width">
      <div className="hero-copy">
        <div className="eyebrow"><Sparkles size={14} /> Masakan rumahan, rasa yang pulang</div>
        <h1>Yang hangat,<br /><em>tinggal pesan.</em></h1>
        <p>Menu sederhana yang dimasak dengan sepenuh hati. Pilih favoritmu, kami siapkan untuk diambil.</p>
        <div className="hero-actions"><button className="primary-button" onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}>Lihat menu <ArrowRight size={17} /></button><span className="open-status"><i className={storeOpen ? 'open-dot' : 'closed-dot'} />{storeOpen ? 'Warung sedang buka' : 'Warung sedang tutup'}</span></div>
      </div>
      <div className="hero-image-wrap"><img src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=88" alt="Hidangan rumahan Mamayo Kitchen" /><div className="hero-float"><span className="float-icon">♥</span><span><b>Dimasak hari ini</b><small>Dengan bahan pilihan</small></span></div></div>
    </section>
    <section className="trust-row page-width"><span><Clock3 size={18} /> Siap dalam 20–30 menit</span><span><MapPin size={18} /> Ambil di warung</span><span><Check size={18} /> Tanpa minimum order</span></section>
    <section className="menu-section page-width" id="menu">
      <div className="section-heading"><div><span className="eyebrow">Dari dapur Mamayo</span><h2>Menu hari ini</h2></div><div className="search-box"><Search size={17} /><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Cari makanan..." aria-label="Cari makanan" /></div></div>
      <div className="filter-row"><div className="categories">{categories.map((item) => <button key={item.id} className={category === item.id ? 'selected' : ''} onClick={() => onCategory(item.id)}>{item.label}</button>)}</div></div>
      <div className="menu-grid">{menu.map((item) => <MenuCard key={item.id} item={item} onAdd={onAdd} />)}</div>
      {menu.length === 0 && <div className="empty-state"><span>⌕</span><h3>Menu tidak ditemukan</h3><p>Coba kata kunci atau kategori lain.</p></div>}
    </section>
    <section className="status-strip page-width"><div><span className="eyebrow">Sudah pesan?</span><h3>Lacak pesananmu di sini.</h3><p>Masukkan pesanan dan pantau sampai siap diambil.</p></div>{orders.length > 0 ? <button className="outline-button" onClick={() => onStatus(orders[0])}>Lihat pesanan terakhir <ArrowRight size={16} /></button> : <button className="outline-button" onClick={onCart}>Buka keranjang <ArrowRight size={16} /></button>}</section>
    <Footer />
  </main>
}

function MenuCard({ item, onAdd }: { item: MenuItem; onAdd: (item: MenuItem) => void }) {
  return <article className={`menu-card ${!item.available ? 'unavailable' : ''}`}>
    <div className="card-image"><img src={item.image} alt={item.name} />{item.popular && <span className="popular-badge">Favorit</span>}{!item.available && <span className="sold-badge">Habis hari ini</span>}</div>
    <div className="card-content"><div className="card-category">{item.categoryLabel}</div><div className="menu-rating" aria-label={`Rating ${item.rating} dari 5, ${item.reviewCount} ulasan`}><span className="rating-stars" aria-hidden="true">★★★★★</span><strong>{item.rating.toFixed(1)}</strong><small>({item.reviewCount})</small></div><h3>{item.name}</h3><p>{item.description}</p><div className="card-bottom"><strong>{formatRupiah(item.price)}</strong><button className="add-button" onClick={() => onAdd(item)} disabled={!item.available} aria-label={`Tambah ${item.name}`}><Plus size={18} /></button></div></div>
  </article>
}

function Checkout({ cart, storeOpen, onBack, onUpdate, onSubmit }: { cart: CartLine[]; storeOpen: boolean; onBack: () => void; onUpdate: (id: string, delta: number) => void; onSubmit: (form: { name: string; whatsapp: string; pickup: string; note: string; payment: PaymentMethod; paymentProof?: string }) => void }) {
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [pickup, setPickup] = useState('12.30–13.00')
  const [note, setNote] = useState('')
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [paymentProof, setPaymentProof] = useState('')
  const [error, setError] = useState('')
  const total = cartTotal(cart)
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) { setError('Nama perlu diisi supaya pesanan mudah ditemukan.'); return }
    if (!isValidWhatsapp(whatsapp)) { setError('Masukkan nomor WhatsApp yang valid, contoh: 081234567890.'); return }
    if (!storeOpen) { setError('Warung sedang tutup. Pesanan belum dapat dibuat.'); return }
    onSubmit({ name: name.trim(), whatsapp: whatsapp.trim(), pickup, note: note.trim(), payment, paymentProof: payment === 'transfer' ? paymentProof : undefined })
  }

  return <main className="page-width checkout-page"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Kembali ke menu</button><div className="checkout-layout"><section><div className="eyebrow">Langkah terakhir</div><h1>Atur pesananmu.</h1><p className="intro-copy">Isi detail di bawah, lalu kami siapkan makananmu dengan hangat.</p><form onSubmit={submit}>
    <fieldset><legend>Detail pelanggan</legend><label>Nama <span>*</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Rani Putri" /></label><label>Nomor WhatsApp <span>*</span><small>untuk konfirmasi pesanan</small><input required inputMode="tel" autoComplete="tel" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="08xxxxxxxxxx" /></label></fieldset>
    <fieldset><legend>Pengambilan</legend><label>Perkiraan waktu ambil<select value={pickup} onChange={(event) => setPickup(event.target.value)}><option>12.30–13.00</option><option>13.00–13.30</option><option>14.00–14.30</option><option>17.30–18.00</option><option>19.00–19.30</option></select></label><label>Catatan pesanan <small>opsional</small><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: sambal dipisah..." rows={3} /></label></fieldset>
    <fieldset><legend>Metode pembayaran</legend><div className="payment-options"><PaymentOption active={payment === 'cash'} onClick={() => setPayment('cash')} icon="◌" title="Tunai saat ambil" description="Bayar langsung di warung" /><PaymentOption active={payment === 'transfer'} onClick={() => setPayment('transfer')} icon="▣" title="Transfer / QRIS" description="Konfirmasi setelah pembayaran" /></div>{payment === 'transfer' && <div className="transfer-info"><b>Transfer ke Mamayo Kitchen</b><span>BCA · 1234 5678 · a.n. Mamayo Kitchen</span><label className="file-label">{paymentProof ? `✓ ${paymentProof}` : 'Lampirkan bukti pembayaran'}<input type="file" accept="image/*,.pdf" onChange={(event) => setPaymentProof(event.target.files?.[0]?.name ?? '')} /></label></div>}</fieldset>
    {error && <div className="form-error">{error}</div>}<button className="primary-button full-button" disabled={cart.length === 0} type="submit">Konfirmasi pesanan <ArrowRight size={17} /></button>
  </form></section><aside><div className="summary-card"><div className="summary-heading"><h2>Pesananmu</h2><span>{cart.reduce((sum, line) => sum + line.quantity, 0)} item</span></div>{cart.length === 0 ? <div className="empty-cart"><ShoppingBag size={26} /><p>Keranjangmu masih kosong.</p><button className="text-button" onClick={onBack}>Pilih menu</button></div> : <>{cart.map((line) => <div className="summary-item" key={line.item.id}><img src={line.item.image} alt="" /><div><b>{line.item.name}</b><span>{formatRupiah(line.item.price)}</span><div className="quantity"><button onClick={() => onUpdate(line.item.id, -1)}><Minus size={12} /></button><span>{line.quantity}</span><button onClick={() => onUpdate(line.item.id, 1)}><Plus size={12} /></button></div></div><strong>{formatRupiah(line.item.price * line.quantity)}</strong></div>)}<div className="summary-total"><span>Total pembayaran</span><strong>{formatRupiah(total)}</strong></div></>}</div><div className="pickup-note"><MapPin size={17} /><div><b>Ambil di Mamayo Kitchen</b><span>Jl. Melati No. 12 · 10.00–21.00</span></div></div></aside></div></main>
}

function PaymentOption({ active, onClick, icon, title, description }: { active: boolean; onClick: () => void; icon: string; title: string; description: string }) { return <button type="button" className={`payment-option ${active ? 'active' : ''}`} onClick={onClick}><span className="payment-icon">{icon}</span><span><b>{title}</b><small>{description}</small></span>{active && <Check size={16} />}</button> }

function Success({ order, onStatus, onShop }: { order: Order; onStatus: () => void; onShop: () => void }) { return <main className="center-page"><div className="success-card"><div className="success-icon"><Check size={32} /></div><div className="eyebrow">Pesanan berhasil dibuat</div><h1>Siap, {order.customerName.split(' ')[0]}!</h1><p>Pesananmu sudah kami terima dan akan segera kami siapkan.</p><div className="order-code"><span>Kode pesanan</span><strong>{order.code}</strong></div><div className="success-details"><span><Clock3 size={16} /> Ambil sekitar {order.pickupTime}</span><span><MapPin size={16} /> Mamayo Kitchen, Jl. Melati No. 12</span></div><button className="primary-button full-button" onClick={onStatus}>Pantau status pesanan <ArrowRight size={17} /></button><button className="text-button" onClick={onShop}>Kembali ke menu</button></div></main> }

function Status({ order, onBack }: { order: Order; onBack: () => void }) {
  const steps: OrderStatus[] = ['pending', 'processing', 'ready', 'completed']
  const currentIndex = steps.indexOf(order.status)
  return <main className="page-width status-page"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Kembali ke menu</button><div className="status-header"><div><div className="eyebrow">Pesanan {order.code}</div><h1>{order.status === 'cancelled' ? 'Pesanan dibatalkan' : statusLabel[order.status]}</h1><p>Terima kasih sudah mempercayakan makan siangmu ke Mamayo.</p></div><div className={`status-pill ${order.status}`}>{statusLabel[order.status]}</div></div>{order.status !== 'cancelled' && <div className="timeline">{steps.map((step, index) => <div className={`timeline-step ${index <= currentIndex ? 'done' : ''}`} key={step}><div className="timeline-marker">{index <= currentIndex ? <Check size={15} /> : index + 1}</div><div><b>{statusLabel[step]}</b><span>{step === 'pending' ? 'Pesanan masuk ke dapur' : step === 'processing' ? 'Chef Mamayo sedang memasak' : step === 'ready' ? 'Silakan ambil di warung' : 'Selamat menikmati!'}</span></div></div>)}</div>}<div className="status-order-card"><div className="summary-heading"><h2>Rincian pesanan</h2><span>{new Date(order.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>{order.items.map((item) => <div className="status-line" key={item.itemId}><span>{item.quantity}× {item.name}</span><strong>{formatRupiah(item.price * item.quantity)}</strong></div>)}<div className="summary-total"><span>Total</span><strong>{formatRupiah(order.total)}</strong></div><div className="payment-line"><span>Bayar dengan {paymentLabel[order.paymentMethod]}</span><span className={order.paymentStatus === 'verified' ? 'verified' : ''}>{order.paymentStatus === 'verified' ? 'Terverifikasi' : order.paymentMethod === 'cash' ? 'Saat pengambilan' : 'Menunggu konfirmasi'}</span></div></div></main>
}

function Admin({ data, onData, onBack }: { data: ReturnType<typeof useStore>['data']; onData: ReturnType<typeof useStore>['setData']; onBack: () => void }) {
  const [tab, setTab] = useState<'orders' | 'menu' | 'analytics'>('orders')
  const [period, setPeriod] = useState<ReportPeriod>('daily')
  const [authed, setAuthed] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const pending = data.orders.filter((order) => !['completed', 'cancelled'].includes(order.status)).length
  const analytics = useMemo(() => getSalesAnalytics(data.orders, period), [data.orders, period])
  if (!authed) return <main className="center-page"><div className="admin-login"><div className="brand-mark large">M</div><div className="eyebrow">Area pemilik</div><h1>Selamat datang kembali.</h1><p>Masuk untuk mengelola menu dan pesanan Mamayo Kitchen.</p><form onSubmit={(event) => { event.preventDefault(); if (pin === 'mamayo') setAuthed(true); else setPinError(true) }}><label>Kata sandi demo<input autoFocus type="password" value={pin} onChange={(event) => { setPin(event.target.value); setPinError(false) }} placeholder="Masukkan kata sandi" /></label>{pinError && <div className="form-error">Kata sandi belum benar. (Demo: mamayo)</div>}<button className="primary-button full-button">Masuk ke dashboard <ArrowRight size={17} /></button></form><button className="text-button" onClick={onBack}>Kembali ke halaman pelanggan</button></div></main>
  const toggleAvailability = (itemId: string) => onData((current) => ({ ...current, menu: current.menu.map((item) => item.id === itemId ? { ...item, available: !item.available } : item) }))
  const advance = (order: Order) => { const next = nextOrderStatus[order.status]; if (next) onData((current) => ({ ...current, orders: current.orders.map((item) => item.id === order.id ? { ...item, status: next, paymentStatus: next === 'processing' && item.paymentMethod === 'transfer' ? 'verified' : item.paymentStatus } : item) })) }
  const updatePrice = (itemId: string, value: string) => {
    const price = Number(value)
    if (!Number.isFinite(price) || price < 0) return
    onData((current) => ({ ...current, menu: current.menu.map((item) => item.id === itemId ? { ...item, price } : item) }))
  }
  return <main className="admin-page page-width"><div className="admin-top"><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Tampilan pelanggan</button><div className="admin-store-status"><i className={data.settings.isOpen ? 'open-dot' : 'closed-dot'} /> Warung {data.settings.isOpen ? 'buka' : 'tutup'} <button onClick={() => onData((current) => ({ ...current, settings: { ...current.settings, isOpen: !current.settings.isOpen } }))}>{data.settings.isOpen ? 'Tutup sementara' : 'Buka warung'}</button></div></div><div className="admin-heading"><div><div className="eyebrow">Dashboard hari ini</div><h1>Halo, Mamayo.</h1><p>Kelola pesanan dan menu dari satu tempat.</p></div><div className="admin-stats"><div><strong>{pending}</strong><span>Pesanan aktif</span></div><div><strong>{data.menu.filter((item) => item.available).length}</strong><span>Menu tersedia</span></div></div></div><div className="admin-tabs"><button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Pesanan <span>{pending}</span></button><button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>Statistik</button><button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}>Katalog menu</button></div>{tab === 'orders' ? <div className="admin-orders">{data.orders.map((order) => <AdminOrder key={order.id} order={order} onAdvance={() => advance(order)} />)}</div> : tab === 'menu' ? <div className="admin-menu-list">{data.menu.map((item) => <div className="admin-menu-row" key={item.id}><img src={item.image} alt="" /><div><b>{item.name}</b><span>{item.categoryLabel}</span></div><div className="admin-menu-price"><span>Harga</span><div><small>Rp</small><input type="number" min="0" step="1000" value={item.price} onChange={(event) => updatePrice(item.id, event.target.value)} aria-label={`Harga ${item.name}`} /></div></div><button className={`availability ${item.available ? 'available' : ''}`} onClick={() => toggleAvailability(item.id)}><i />{item.available ? 'Tersedia' : 'Habis'}</button></div>)}</div> : <AdminAnalytics analytics={analytics} period={period} onPeriod={setPeriod} />}</main>
}

function AdminAnalytics({ analytics, period, onPeriod }: { analytics: ReturnType<typeof getSalesAnalytics>; period: ReportPeriod; onPeriod: (period: ReportPeriod) => void }) {
  const maxRevenue = Math.max(...analytics.trend.map((point) => point.revenue), 1)
  const periodLabels: Record<ReportPeriod, string> = { daily: 'Hari ini', weekly: 'Minggu ini', monthly: 'Bulan ini' }
  const changeText = (value: number | null) => value === null ? 'Belum ada pembanding' : `${value > 0 ? '+' : ''}${value}% vs sebelumnya`
  return <section className="analytics-page">
    <div className="analytics-toolbar"><div><div className="eyebrow">Performa penjualan</div><h2>Ringkasan {periodLabels[period].toLowerCase()}</h2><p>Penjualan dihitung dari pesanan yang sudah selesai.</p></div><div className="period-switcher" role="group" aria-label="Periode statistik">{(['daily', 'weekly', 'monthly'] as ReportPeriod[]).map((item) => <button key={item} className={period === item ? 'active' : ''} onClick={() => onPeriod(item)}>{periodLabels[item]}</button>)}</div></div>
    <div className="analytics-stats"><div className="analytics-stat primary"><span>Omzet selesai</span><strong>{formatRupiah(analytics.revenue)}</strong><small>{changeText(analytics.revenueChangePercent)}</small></div><div className="analytics-stat"><span>Pesanan selesai</span><strong>{analytics.completedOrders}</strong><small>{changeText(analytics.ordersChangePercent)}</small></div><div className="analytics-stat"><span>Pelanggan unik</span><strong>{analytics.uniqueCustomers}</strong><small>{analytics.newCustomers} pelanggan baru</small></div><div className="analytics-stat"><span>Repeat customer</span><strong>{analytics.returningCustomers}</strong><small>{analytics.repeatRate}% dari pelanggan</small></div></div>
    <div className="analytics-columns"><section className="analytics-card trend-card"><div className="analytics-card-heading"><div><h3>Tren omzet</h3><p>{period === 'daily' ? 'Per jam berdasarkan waktu pemesanan' : 'Per hari pada periode terpilih'}</p></div><span className="chart-legend"><i /> Omzet</span></div><div className="trend-chart">{analytics.trend.map((point, index) => <div className="trend-column" key={point.label}><div className="trend-bar-wrap"><div className="trend-bar" style={{ height: `${Math.max(point.revenue ? (point.revenue / maxRevenue) * 100 : 0, point.revenue ? 8 : 2)}%` }} title={`${point.label}: ${formatRupiah(point.revenue)}`} /></div><span>{period === 'monthly' ? (index % 5 === 0 ? point.label : '') : period === 'daily' ? (index % 3 === 0 ? point.label : '') : point.label}</span></div>)}</div>{analytics.revenue === 0 && <div className="chart-empty">Belum ada penjualan selesai pada periode ini.</div>}</section><section className="analytics-card customer-card"><div className="analytics-card-heading"><div><h3>Pelanggan</h3><p>Berbasis nomor WhatsApp</p></div><span className="customer-bubble">{analytics.uniqueCustomers}</span></div><div className="customer-total"><strong>{analytics.uniqueCustomers}</strong><span>pelanggan unik</span></div><div className="customer-rows"><div><span>Pelanggan baru</span><b>{analytics.newCustomers}</b></div><div><span>Kembali memesan</span><b>{analytics.returningCustomers}</b></div><div><span>Order tanpa WA</span><b>{analytics.guestOrders}</b></div></div></section></div>
    <section className="analytics-card top-menu-card"><div className="analytics-card-heading"><div><h3>Menu paling laris</h3><p>Urutan berdasarkan jumlah porsi terjual</p></div><span className="eyebrow">{periodLabels[period]}</span></div>{analytics.menuSales.length > 0 ? <div className="top-menu-list">{analytics.menuSales.map((item, index) => <div className="top-menu-row" key={item.itemId}><span className={`menu-rank rank-${index + 1}`}>{index + 1}</span><div className="top-menu-name"><b>{item.name}</b><span>{item.quantity} porsi terjual</span></div><div className="top-menu-revenue"><strong>{formatRupiah(item.revenue)}</strong><span>{analytics.revenue ? Math.round((item.revenue / analytics.revenue) * 100) : 0}% omzet</span></div></div>)}</div> : <div className="analytics-empty"><span>✦</span><b>Belum ada menu terjual</b><p>Pesanan yang selesai akan muncul di sini.</p></div>}</section>
  </section>
}

function AdminOrder({ order, onAdvance }: { order: Order; onAdvance: () => void }) { const next = nextOrderStatus[order.status]; return <article className="admin-order"><div className="order-main"><div className="order-title"><span className="order-code">{order.code}</span><span className={`status-pill ${order.status}`}>{statusLabel[order.status]}</span></div><h3>{order.customerName}</h3><p>{order.items.map((item) => `${item.quantity}× ${item.name}`).join(' · ')}</p><div className="order-meta"><span><Clock3 size={14} /> Ambil {order.pickupTime}</span><span>{paymentLabel[order.paymentMethod]}{order.paymentProof ? ' · Bukti terlampir' : ''}</span>{order.note && <span>“{order.note}”</span>}</div></div><div className="order-side"><strong>{formatRupiah(order.total)}</strong>{next && <button className="primary-button small-button" onClick={onAdvance}>{next === 'processing' ? 'Mulai masak' : next === 'ready' ? 'Tandai siap' : 'Selesaikan'} <ArrowRight size={14} /></button>}</div></article> }

function Footer() { return <footer className="footer page-width"><div className="footer-brand"><span className="brand-mark">M</span><div><b>Mamayo Kitchen</b><span>Masakan rumahan, rasa yang pulang.</span></div></div><div className="footer-info"><span><MapPin size={15} /> Jl. Melati No. 12, Jakarta Selatan</span><span><Clock3 size={15} /> Setiap hari · 10.00–21.00</span><span><AtSign size={15} /> @mamayokitchen</span></div><span className="footer-note">© 2024 Mamayo Kitchen</span></footer> }

export default App
