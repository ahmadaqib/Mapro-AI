# <img src="client/public/assets/logo.png" align="right" width="100" /> Mapro-AI

Asisten AI yang cerdas, berpendirian, dan tidak mudah ditundukkan.

Mapro bukanlah sekadar alat bantu pasif. Mapro adalah mitra berpikir yang memiliki sudut pandang sendiri, siap menantang argumen Anda, mendeteksi cacat logika (*logical fallacy*), dan bertindak sebagai *devil's advocate* untuk menguji keyakinan berpikir Anda.

Mapro menggunakan model AI dari Xiaomi: `mimo-v2.5-pro`.

---

## 🚀 Fitur Utama
- **AI Debater & Advisor**: Menantang asumsi, meminta bukti, dan memberikan perspektif alternatif.
- **Bahasa Indonesia yang Lugas**: Menggunakan gaya bahasa yang santai namun tetap tajam, intelektual, dan langsung pada intinya.
- **Mode Privat**: Percakapan sementara yang tidak disimpan di riwayat lokal.
- **Riwayat Percakapan**: Sesi web tersimpan otomatis dan bisa dibuka kembali dari sidebar.
- **Tampilan Premium**: Antarmuka berbasis web modern dengan visual premium, efek *glassmorphism*, dan transisi halus.

## 🛠️ Instalasi & Menjalankan Project

### Prerequisites
- Node.js (v18+)
- Mimo API Key (simpan di berkas `.env` sebagai `MIMO_API_KEY`)

Contoh `.env`:
```bash
MIMO_API_KEY=isi_api_key_anda
```

### CLI Chat Mode
Untuk mengobrol langsung melalui terminal:
```bash
npm run chat
```

### Web App Mode
Install dependency backend dan frontend terlebih dahulu:
```bash
cd server && npm install
cd ../client && npm install
cd ..
```

Jalankan backend dan frontend sekaligus:
```bash
./start.sh
```

Buka peramban di `http://localhost:5173`.

Jika ingin menjalankan manual di dua terminal terpisah:
```bash
cd server
npm run dev
```

```bash
cd client
npm run dev
```
