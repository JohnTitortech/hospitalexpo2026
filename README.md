# Booth Monitoring Dashboard — IIHE 2026

Dashboard sederhana untuk memonitor performa booth pada
**The 38th Indonesia International Hospital Expo 2026 (7–10 October 2026)**.

Website ini **static** (HTML + CSS + Vanilla JS), tanpa backend, tanpa database,
dan menyimpan data di `localStorage` browser. Cocok untuk di-deploy langsung ke
GitHub Pages.

## Struktur Project

```
/
├── index.html   # struktur halaman + Chart.js & plugin datalabels di-inline langsung di dalamnya
├── style.css
├── script.js
└── README.md
```

> **Kenapa Chart.js ditempel langsung (inline) di `index.html`, bukan file
> terpisah atau CDN?**
> Awalnya library ini dimuat lewat CDN, lalu dicoba dipindah ke file terpisah
> di folder `vendor/`. Keduanya ternyata rawan gagal di komputer sebagian
> pengguna — CDN diblokir oleh Tracking Prevention/firewall, sedangkan folder
> terpisah kadang tidak ikut ter-copy saat file dipindahkan. Dengan
> menempelkan kode library langsung di dalam `index.html`, satu file itu saja
> sudah cukup untuk menjalankan seluruh dashboard beserta grafiknya — tidak
> ada lagi bagian yang bisa "hilang" saat disalin ke folder lain atau
> di-upload ke GitHub Pages.

## Cara Kerja

1. Tim booth membuka salah satu tab: **DAY 1–4**.
2. Mengisi form (Booth Visitor, Follower Up per platform, Serious Buyer, Challenge Story).
3. Klik **SAVE DATA** → data tersimpan di `localStorage`, dashboard & grafik langsung update.
4. Tab **TODAY** otomatis menampilkan data hari yang sedang berjalan (berdasarkan
   tanggal sistem perangkat) — bukan input terpisah, hanya menampilkan ulang data
   Day yang sesuai.
5. Tab **SUMMARY** menampilkan total seluruh event + 4 grafik (Booth Visitor,
   Follower Up, Serious Buyer, Challenge Story) dari hari-hari yang sudah
   memiliki data saja.

## Data Demo

Saat pertama kali dibuka (localStorage kosong), website otomatis mengisi
**DEMO DATA** untuk Day 1–4 agar tampilan bisa langsung dicoba. Selama data
masih berupa demo, label **DEMO DATA** akan muncul di Day panel & Summary.
Begitu Anda menyimpan (SAVE) data baru pada hari mana pun, atau mengimpor
data, label demo otomatis hilang.

## Export / Import

- **EXPORT DATA** (di tab Summary) mengunduh file `.csv` berisi seluruh data
  4 hari (Day, Date, Booth Visitor, Instagram, TikTok, Facebook, Total
  Follower, Serious Buyer, Challenge Story).
- **IMPORT DATA** menerima file `.csv` (format sama dengan hasil export) atau
  `.json`, untuk memindahkan data antar browser/device.

## Reset Data

Tombol **RESET DATA** akan meminta konfirmasi sebelum menghapus seluruh data
tersimpan. Tindakan ini tidak bisa dibatalkan.

## Validasi Input

Semua input angka wajib:
- Integer (bukan desimal)
- Minimum 0 (tidak boleh negatif)
- Kosong dianggap 0, dengan pesan error ditampilkan bila nilai tidak valid.

## Deploy ke GitHub Pages

1. Buat repository baru di GitHub, upload ketiga file (`index.html`,
   `style.css`, `script.js`) beserta README ini.
2. Masuk ke **Settings → Pages**.
3. Pilih branch `main` (atau `master`) dan folder `/root`, lalu **Save**.
4. Tunggu beberapa menit, website akan aktif di
   `https://<username>.github.io/<nama-repo>/`.

Tidak ada proses build. Tidak ada dependency Node.js untuk menjalankan website
ini (Node.js hanya dipakai satu kali oleh pengembang untuk mengambil kode
Chart.js yang kemudian ditempel langsung ke `index.html`). Chart.js & plugin
datalabels sudah menyatu di dalam `index.html`, jadi tidak butuh file
tambahan maupun koneksi ke CDN eksternal saat halaman dibuka.

## Catatan Teknis

- Data disimpan per-hari secara terpisah di dalam satu object JSON di
  `localStorage` (key `iihe2026_data`), sehingga mengisi Day 2 tidak akan
  menimpa Day 1, dst.
- Grafik dibangun dengan [Chart.js](https://www.chartjs.org/) dan hanya
  menampilkan hari-hari yang sudah memiliki data (hari kosong tidak
  ditampilkan sebagai 0).
- Kode sengaja dibuat sederhana (functions biasa, tanpa framework/component
  architecture) supaya mudah dimodifikasi oleh siapa pun di tim.
