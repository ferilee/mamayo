# Mamayo Kitchen

MVP pemesanan makanan untuk warung Mamayo Kitchen. Aplikasi mencakup katalog, keranjang, checkout pembayaran manual, pelacakan pesanan, dashboard pemilik, dan statistik penjualan harian/mingguan/bulanan.

## Menjalankan

```bash
npm install
npm run dev
```

Data demo disimpan di `localStorage` browser. Nomor WhatsApp wajib diisi saat checkout dan menjadi identitas pelanggan untuk statistik. Dashboard pemilik menggunakan kata sandi demo `mamayo`; autentikasi ini hanya untuk prototipe frontend dan perlu diganti dengan autentikasi backend sebelum produksi.

Statistik penjualan hanya menghitung order berstatus selesai. Pelanggan unik dihitung dari nomor WhatsApp yang dinormalisasi; menu terlaris diurutkan berdasarkan jumlah porsi. Tema pertama kali mengikuti preferensi sistem dan dapat diubah melalui tombol matahari/bulan di header.

## Pemeriksaan

```bash
npm run test
npm run build
```
