# Mamayo Kitchen

MVP pemesanan makanan untuk warung Mamayo Kitchen. Aplikasi mencakup katalog, keranjang, checkout pembayaran manual, pelacakan pesanan, dashboard pemilik, dan statistik penjualan harian/mingguan/bulanan.

## Menjalankan

```bash
npm install
npm run dev
```

Data menu, pesanan, dan pengaturan disimpan di SQLite pada `data/mamayo.sqlite`. Jalankan `npm run dev` untuk menyalakan API Express di port 3001 dan frontend Vite di port 5173. Perubahan order, menu, dan status warung dikirim ke tab lain secara realtime melalui Server-Sent Events.

Nomor WhatsApp wajib diisi saat checkout dan menjadi identitas pelanggan untuk statistik. Dashboard pemilik masih menggunakan kata sandi demo `mamayo`; autentikasi ini hanya untuk prototipe frontend dan wajib diganti dengan autentikasi backend sebelum produksi.

Pada tab **Katalog menu**, pemilik dapat menekan **Edit menu** untuk mengubah nama, deskripsi, harga, kategori, dan gambar. Gambar dapat diunggah langsung (maksimal 5 MB) atau memakai URL gambar, kemudian tekan **Simpan perubahan**. Tombol **Tersedia/Habis** digunakan untuk mengubah ketersediaan dengan cepat.

### Notifikasi Telegram pemilik

Salin `.env.example` menjadi `.env`, lalu isi `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID`. Pemilik perlu membuka chat bot dan mengirim `/start` terlebih dahulu. Setelah itu server akan mengirim notifikasi pesanan baru dan perubahan status meskipun dashboard/browser pemilik sedang ditutup, selama server backend tetap berjalan.

Statistik penjualan hanya menghitung order berstatus selesai. Pelanggan unik dihitung dari nomor WhatsApp yang dinormalisasi; menu terlaris diurutkan berdasarkan jumlah porsi. Tema pertama kali mengikuti preferensi sistem dan dapat diubah melalui tombol matahari/bulan di header.

Aplikasi juga menyediakan favicon, preview Open Graph untuk berbagi tautan, serta dukungan PWA. Pada build produksi, service worker mendaftarkan cache shell aplikasi dan tidak melakukan cache terhadap endpoint API.

## Pemeriksaan

```bash
npm run test
npm run build
```
