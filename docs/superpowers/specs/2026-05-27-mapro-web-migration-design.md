# Mapro Web Migration — Design Spec
_2026-05-27_

## Overview

Migrasi dari single-file CLI (`chat.ts`) ke arsitektur modular dengan web frontend. CLI tetap dipertahankan. Keduanya berbagi `history.json` yang sama.

**Stack:**
- Frontend: React + Vite + TypeScript
- Backend: Fastify + TypeScript
- AI: Xiaomi Mimo API (`mimo-v2.5-pro`) via OpenAI-compatible SDK
- Streaming: Server-Sent Events (SSE)

---

## Project Structure

```
mimoAI-test/
├── client/                        ← React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── ReasoningBlock.tsx
│   │   │   ├── InputBar.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── hooks/
│   │   │   └── useChat.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── server/                        ← Fastify + TypeScript backend
│   ├── src/
│   │   ├── routes/
│   │   │   └── chat.ts
│   │   ├── services/
│   │   │   ├── agent.ts
│   │   │   └── history.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── tsconfig.json
│   └── package.json
│
├── chat.ts                        ← CLI (tetap ada, tidak diubah)
├── history.json                   ← shared: CLI + web pakai file yang sama
├── start.sh                       ← jalankan server + client sekaligus
├── mimo.test.ts                   ← API test suite (tidak berubah)
├── package.json                   ← root: scripts chat + test
└── vitest.config.ts
```

---

## Backend Architecture

### Prinsip
Dependency flow satu arah: `routes → services → types`. Tidak ada circular dependency. Setiap modul punya satu tanggung jawab.

### File Responsibilities

| File | Tanggung Jawab |
|---|---|
| `index.ts` | Bootstrap Fastify, register CORS & plugins, mount routes |
| `routes/chat.ts` | Definisi route, validasi input schema, delegate ke service |
| `services/agent.ts` | System prompt Mapro, streaming dari Mimo API, parse SSE chunks |
| `services/history.ts` | Baca/tulis `history.json`, validasi format, error recovery |
| `types.ts` | Shared TypeScript types: `Message`, `SseEvent`, `ChatRequest` |

### API Endpoints

| Method | Path | Response | Fungsi |
|---|---|---|---|
| `POST /api/chat` | `text/event-stream` | Streaming SSE |
| `GET /api/history` | `application/json` | Ambil semua history |
| `DELETE /api/history` | `application/json` | Reset history |

### SSE Event Format

Server mengirim event bertipe:

```
event: reasoning
data: {"text": "...chunk teks thinking..."}

event: token
data: {"text": "...chunk teks jawaban..."}

event: done
data: {}

event: error
data: {"message": "...pesan error..."}
```

Frontend memisahkan tampilan reasoning dan jawaban berdasarkan tipe event.

### CORS
Hanya menerima request dari `http://localhost:5173` pada development.

### Port
Backend berjalan di `http://localhost:3000`.

---

## Frontend Architecture

### Prinsip
State terpusat di satu custom hook (`useChat`). Komponen hanya render — tidak pegang state sendiri di luar UI state lokal (expanded/collapsed, dll).

### Component Tree

```
App
├── Sidebar
│   ├── Logo / nama "Mapro"
│   ├── HistoryList (daftar pesan singkat)
│   ├── Tombol Reset
│   └── [collapse jadi drawer di mobile]
└── ChatWindow
    ├── MessageBubble[] (dirender dari messages[])
    │   └── ReasoningBlock (collapsible, hanya di pesan Mapro)
    └── InputBar
        ├── Textarea (auto-resize)
        └── SendButton (disabled + shimmer saat streaming)
```

### State — `useChat.ts`

```ts
{
  messages: Message[]     // semua pesan dalam sesi
  isStreaming: boolean    // true saat menerima SSE
  sendMessage(text: string): void
  resetHistory(): void
}
```

Hook membuka `EventSource` ke `POST /api/chat` menggunakan `fetch` + `ReadableStream` (bukan native `EventSource` karena tidak support POST). Setiap chunk di-append ke pesan Mapro yang sedang aktif.

### Visual Design

**Background:** gradient radial `#07070f → #0d0d1a` dengan 2-3 blob warna (purple `#6c3fc4`, blue `#2563eb`, teal `#0d9488`) yang blurry dan subtle di background.

**Panel / Card:** `backdrop-filter: blur(20px)`, `background: rgba(255,255,255,0.04)`, `border: 1px solid rgba(255,255,255,0.08)`, `border-radius: 16px`.

**Bubble user:** right-aligned, glass dengan tint biru `rgba(37,99,235,0.15)`.

**Bubble Mapro:** left-aligned, glass gelap, label `MAPRO` uppercase kecil di atas, warna teks `rgba(255,255,255,0.9)`.

**ReasoningBlock:** accordion collapsible, font `JetBrains Mono`, warna `rgba(255,255,255,0.35)`, border kiri `2px solid rgba(255,255,255,0.1)`. Default: collapsed, expand on click.

**InputBar:** sticky bottom, full-width glass, textarea tanpa resize handle, placeholder "Tulis pesan...", send button dengan icon panah, loading shimmer animation saat streaming.

**Tipografi:** Inter atau Geist untuk UI, JetBrains Mono untuk reasoning.

### Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| `≥ 768px` | Sidebar 260px fixed kiri + chat area flex-grow |
| `< 768px` | Sidebar jadi slide-in drawer, toggle button di header, chat full width |

---

## Streaming Flow (End-to-End)

```
1. User ketik pesan → sendMessage() di useChat
2. fetch POST /api/chat dengan body {message, history}
3. Server: routes/chat.ts terima request
4. Server: agent.ts panggil Mimo API dengan stream: true
5. Server: parse chunks — reasoning_content → event:reasoning, content → event:token
6. Server: flush SSE ke client chunk by chunk
7. Client: ReadableStream reader decode TextDecoder
8. Client: parse "event:" dan "data:" lines
9. Client: append ke messages[] — reasoning ke ReasoningBlock, token ke bubble content
10. Server: kirim event:done → isStreaming = false
```

---

## start.sh

```bash
#!/bin/bash
trap 'kill 0' EXIT

echo "Starting Mapro backend (port 3000)..."
(cd server && npm run dev) &

echo "Starting Mapro frontend (port 5173)..."
(cd client && npm run dev) &

wait
```

`trap 'kill 0' EXIT` memastikan kedua proses mati saat script di-Ctrl+C.

---

## Error Handling

| Skenario | Penanganan |
|---|---|
| API Mimo error | Server kirim `event: error`, client tampilkan pesan merah di chat |
| `history.json` corrupt | `history.ts` reset otomatis, log warning ke console |
| Network timeout | Client tampilkan pesan error, `isStreaming = false` |
| CORS violation | Fastify tolak dengan 403 |

---

## Yang Tidak Berubah

- `chat.ts` — CLI tetap jalan dengan `npm run chat`
- `mimo.test.ts` — test suite API tidak diubah
- `history.json` — format sama, shared antara CLI dan web
- API key — tetap dari `.env` / env variable
