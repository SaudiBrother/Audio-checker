# 🎵 Soundnalyze

**Analisis kualitas audio langsung di browser — tanpa upload ke server.**

Soundnalyze menggunakan FFT engine (Cooley-Tukey Radix-2) murni JavaScript untuk mendeteksi fake/upscaled bitrate, visualisasi spektrum frekuensi, dan membandingkan kualitas antar file audio.

[![GitHub Pages](https://img.shields.io/badge/Hosting-GitHub%20Pages-blue?logo=github)](https://pages.github.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-purple?logo=pwa)](https://web.dev/progressive-web-apps/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## ✨ Fitur Utama

| Fitur | Keterangan |
|-------|-----------|
| 🔬 Real FFT Engine | Cooley-Tukey Radix-2 DIT — bukan OfflineAudioContext |
| 📊 Spectrogram + Waveform | Toggle antara spectrum view dan waveform per card |
| 🎵 Audio Playback | Putar langsung dari dalam card hasil analisis |
| 📦 Batch Processing | Analisis banyak file sekaligus, pause/resume |
| ⚖️ Comparison Mode | Bandingkan hingga 6 file dalam satu chart |
| 📤 Export CSV / JSON | Ekspor semua hasil analisis |
| 🌙 Dark / Light Mode | Toggle tema, disimpan ke localStorage |
| 📴 PWA Offline | Semua fitur berjalan tanpa internet |
| 🏠 Installable | Bisa diinstal sebagai app di Android, iOS, Desktop |

---

## 🗂️ Struktur Repo

```
soundnalyze/
│
├── index.html          ← Aplikasi utama
├── style.css           ← Semua styling
├── script.js           ← Logic + FFT engine
├── sw.js               ← Service Worker (offline/cache)
├── manifest.json       ← PWA manifest (install, icon, nama)
├── offline.html        ← Halaman saat offline
│
├── assets/             ← Semua icon & gambar
│   ├── icon.svg
│   ├── icon-72.png
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-144.png
│   ├── icon-152.png
│   ├── icon-192.png
│   ├── icon-384.png
│   ├── icon-512.png
│   ├── icon-maskable-192.png
│   ├── icon-maskable-512.png
│   └── apple-touch-icon.png
│
├── .gitignore
└── README.md
```

---

## 🚀 Deploy ke GitHub Pages

### 1. Fork / Clone repo ini

```bash
git clone https://github.com/USERNAME/soundnalyze.git
cd soundnalyze
```

### 2. Push ke GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 3. Aktifkan GitHub Pages

1. Buka **Settings** → **Pages**
2. Source: `Deploy from a branch`
3. Branch: `main` / folder: `/ (root)`
4. Klik **Save**

Setelah beberapa menit, situs akan live di:
```
https://USERNAME.github.io/soundnalyze/
```

### ⚠️ Catatan penting

- `sw.js` **harus ada di root repo** (sejajar `index.html`) agar bisa mengontrol seluruh halaman
- Service Worker sudah otomatis mendeteksi base path, jadi berjalan baik di root domain maupun subdirektori
- Tidak perlu build tools — semua langsung di-serve sebagai static files

---

## 🔄 Update Aplikasi

Setiap kali deploy perubahan, bump `CACHE_VERSION` di `sw.js`:

```js
// sw.js baris 18
const CACHE_VERSION = 'soundnalyze-v3.0.1'; // ← ganti angkanya
```

Ini akan otomatis membersihkan cache lama dan mengunduh versi terbaru.

---

## 📱 Install sebagai App

| Platform | Cara Install |
|----------|-------------|
| **Android (Chrome)** | Tap banner "Tambahkan ke layar utama" atau menu ⋮ → Install app |
| **iOS (Safari)** | Tap ikon Share → "Tambahkan ke Layar Utama" |
| **Desktop (Chrome/Edge)** | Klik ikon ⊕ di address bar atau tombol Install di navbar |

---

## 🛠️ Cara Kerja FFT Engine

Soundnalyze menggunakan implementasi **Cooley-Tukey Radix-2 DIT FFT** murni JavaScript — tidak bergantung pada `OfflineAudioContext.AnalyserNode` yang tidak reliable untuk analisis akurat.

Pipeline analisis:
1. `file.arrayBuffer()` → `AudioContext.decodeAudioData()` → PCM samples
2. Mix ke mono (tanpa AudioContext baru — no memory leak)
3. Ekstrak segmen tengah audio (skip 5% awal & akhir)
4. Hann window + FFT dengan 32 frame overlap (50%)
5. Power spectrum rata-rata → dBFS
6. Deteksi cutoff frequency, HF energy, dynamic range, spectral flatness
7. Evaluasi quality score (0–100)

---

## 📜 Lisensi

MIT License — bebas digunakan, dimodifikasi, dan didistribusikan.
