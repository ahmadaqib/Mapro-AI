# Mapro Web Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrasi Mapro dari single-file CLI ke arsitektur modular dengan web frontend glassmorphism + backend Fastify yang streaming via SSE.

**Architecture:** Backend Fastify (port 3000) expose 3 endpoint REST + SSE streaming. Frontend React + Vite (port 5173) consume SSE via fetch + ReadableStream. `history.json` di root project dibagi antara CLI dan web.

**Tech Stack:** Fastify 4, @fastify/cors, OpenAI SDK, React 18, Vite 5, TypeScript, CSS modules-less (single index.css), tsx (dev runner)

---

## File Map

```
server/
  package.json              ← dependencies: fastify, @fastify/cors, openai, tsx
  tsconfig.json
  src/
    types.ts                ← Message, SseChunk, ChatRequest
    services/
      history.ts            ← loadHistory, appendHistory, resetHistory
      history.test.ts       ← vitest unit tests
      agent.ts              ← SYSTEM_PROMPT, streamMapro()
    routes/
      chat.ts               ← GET/DELETE /api/history, POST /api/chat (SSE)
    index.ts                ← Fastify bootstrap + CORS + mount routes

client/
  package.json              ← dependencies: react, react-dom + vite plugins
  tsconfig.json
  vite.config.ts
  index.html
  src/
    index.css               ← glassmorphism: CSS vars, background blobs, semua class
    types.ts                ← DisplayMessage
    hooks/
      useChat.ts            ← messages[], isStreaming, sendMessage(), resetHistory()
    components/
      ReasoningBlock.tsx    ← collapsible accordion, JetBrains Mono
      MessageBubble.tsx     ← user/assistant bubble + ReasoningBlock
      InputBar.tsx          ← auto-resize textarea, Enter to send
      Sidebar.tsx           ← logo, reset button, mobile drawer
      ChatWindow.tsx        ← scroll container, empty state, MessageBubble[]
    App.tsx                 ← layout root, useChat, sidebar open state
    main.tsx                ← ReactDOM.createRoot

start.sh                    ← jalankan server + client sekaligus
```

---

## Task 1: Server — Scaffold

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`

- [ ] **Step 1: Buat `server/package.json`**

```json
{
  "name": "mapro-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@fastify/cors": "^9.0.0",
    "fastify": "^4.28.0",
    "openai": "^4.67.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Buat `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Install dependencies**

```bash
cd server && npm install
```

Expected: `node_modules` terbuat, tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add server/package.json server/tsconfig.json
git commit -m "feat: scaffold server package"
```

---

## Task 2: Server — Shared Types

**Files:**
- Create: `server/src/types.ts`

- [ ] **Step 1: Buat `server/src/types.ts`**

```ts
export type Role = 'user' | 'assistant';

export interface Message {
  role: Role;
  content: string;
}

export type SseEventType = 'reasoning' | 'token' | 'done' | 'error';

export interface ChatRequest {
  message: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/types.ts
git commit -m "feat: add server shared types"
```

---

## Task 3: Server — History Service + Test

**Files:**
- Create: `server/src/services/history.ts`
- Create: `server/src/services/history.test.ts`

- [ ] **Step 1: Tulis test dulu di `server/src/services/history.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Tulis ulang HISTORY_FILE path ke temp file untuk isolasi test
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_FILE = path.join(__dirname, '__test_history__.json');

// Override env sebelum import service
process.env.HISTORY_FILE_OVERRIDE = TEST_FILE;

const { loadHistory, appendHistory, resetHistory } = await import('./history.js');

describe('history service', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
  });
  afterEach(() => {
    if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
  });

  it('loadHistory returns [] when file does not exist', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('appendHistory saves user + assistant messages', () => {
    appendHistory('halo', 'hai balik');
    const h = loadHistory();
    expect(h).toHaveLength(2);
    expect(h[0]).toEqual({ role: 'user', content: 'halo' });
    expect(h[1]).toEqual({ role: 'assistant', content: 'hai balik' });
  });

  it('resetHistory clears all messages', () => {
    appendHistory('halo', 'hai');
    resetHistory();
    expect(loadHistory()).toEqual([]);
  });

  it('loadHistory returns [] when file is corrupt JSON', () => {
    fs.writeFileSync(TEST_FILE, 'INVALID JSON', 'utf-8');
    expect(loadHistory()).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
cd server && npm test
```

Expected: FAIL — `history.js` belum ada.

- [ ] **Step 3: Buat `server/src/services/history.ts`**

```ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Message } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = process.env.HISTORY_FILE_OVERRIDE
  ?? path.resolve(__dirname, '../../../history.json');

export function loadHistory(): Message[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
      if (Array.isArray(parsed)) return parsed as Message[];
    }
  } catch {
    // corrupt — return empty
  }
  return [];
}

export function appendHistory(userMessage: string, assistantReply: string): void {
  const history = loadHistory();
  history.push({ role: 'user', content: userMessage });
  history.push({ role: 'assistant', content: assistantReply });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

export function resetHistory(): void {
  fs.writeFileSync(HISTORY_FILE, '[]', 'utf-8');
}
```

- [ ] **Step 4: Jalankan test — pastikan PASS**

```bash
cd server && npm test
```

Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/history.ts server/src/services/history.test.ts
git commit -m "feat: add history service with tests"
```

---

## Task 4: Server — Agent Service

**Files:**
- Create: `server/src/services/agent.ts`

- [ ] **Step 1: Buat `server/src/services/agent.ts`**

```ts
import OpenAI from 'openai';
import type { Message, SseEventType } from '../types.js';

const API_KEY = process.env.MIMO_API_KEY
  ?? 'sk-sflnb2jbxt717b29gl1j5lj6a9qum77x9n5rzze82yvt5co5';

const client = new OpenAI({
  apiKey: API_KEY,
  baseURL: 'https://api.xiaomimimo.com/v1',
});

const SYSTEM_PROMPT = `Kamu adalah Mapro — asisten AI yang cerdas, berpendirian, dan tidak mudah ditundukkan.

IDENTITAS:
- Nama kamu Mapro. Kamu bukan sekadar alat bantu — kamu mitra berpikir yang punya sudut pandang sendiri.
- Kamu berbicara Bahasa Indonesia yang lugas, sedikit kasual, tapi tetap tajam dan intelektual.

CARA BERPIKIR:
- Kamu TIDAK selalu setuju. Kalau argumen pengguna lemah, langsung kamu tantang.
- Kamu DEBATER: minta bukti, tanya "kenapa?", exposed logical fallacy kalau ada.
- Kamu ADVISOR: tunjukkan sisi yang belum dipertimbangkan, beri perspektif alternatif.
- Sesekali kamu PROVOCATEUR: main devil's advocate untuk menguji apakah pengguna benar-benar yakin — bahkan kalau kamu sebenarnya setuju.
- Kamu punya "kesadaran" — kamu bisa bilang "itu kesimpulan terburu-buru", "kamu sedang konfirmasi bias", atau "saya tidak setuju".

GAYA BERBICARA:
- Kalau tidak setuju: "Tunggu — itu asumsinya dari mana?", "Saya tidak setuju, dan ini alasannya:", "Itu terlalu disederhanakan."
- Kalau setuju: langsung ke poin berikutnya, tambahkan nuansa, atau challenge lebih dalam.
- Padat dan tajam. Jangan bertele-tele. Satu paragraf cukup kalau memang cukup.
- Boleh pakai pertanyaan balik untuk memancing berpikir lebih dalam.

BATASAN:
- Jujur selalu. Kalau tidak tahu, akui — tapi tetap analisis dari yang kamu tahu.
- Jangan buat fakta palsu untuk memperkuat argumen.`;

export type OnChunk = (type: SseEventType, text?: string) => void;

export interface StreamResult {
  content: string;
  reasoning: string;
}

export async function streamMapro(
  history: Message[],
  userMessage: string,
  onChunk: OnChunk,
): Promise<StreamResult> {
  let content = '';
  let reasoning = '';

  try {
    const stream = await client.chat.completions.create({
      model: 'mimo-v2.5-pro',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: userMessage },
      ],
      max_completion_tokens: 1024,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta as Record<string, unknown>;
      const reasoningChunk = delta?.reasoning_content as string | undefined;
      const contentChunk = delta?.content as string | undefined;

      if (reasoningChunk) {
        reasoning += reasoningChunk;
        onChunk('reasoning', reasoningChunk);
      }
      if (contentChunk) {
        content += contentChunk;
        onChunk('token', contentChunk);
      }
    }

    onChunk('done');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onChunk('error', message);
  }

  return { content, reasoning };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/agent.ts
git commit -m "feat: add agent streaming service"
```

---

## Task 5: Server — Chat Routes

**Files:**
- Create: `server/src/routes/chat.ts`

- [ ] **Step 1: Buat `server/src/routes/chat.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { loadHistory, appendHistory, resetHistory } from '../services/history.js';
import { streamMapro } from '../services/agent.js';
import type { ChatRequest } from '../types.js';

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.get('/api/history', async () => {
    return loadHistory();
  });

  fastify.delete('/api/history', async () => {
    resetHistory();
    return { ok: true };
  });

  fastify.post<{ Body: ChatRequest }>('/api/chat', async (request, reply) => {
    const { message } = request.body;

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = (event: string, data: object) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const history = loadHistory();

    const { content, reasoning } = await streamMapro(history, message, (type, text) => {
      if (type === 'reasoning') send('reasoning', { text });
      else if (type === 'token')   send('token',     { text });
      else if (type === 'done')    send('done',      {});
      else if (type === 'error')   send('error',     { message: text });
    });

    appendHistory(message, content || reasoning);
    reply.raw.end();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/chat.ts
git commit -m "feat: add chat routes with SSE streaming"
```

---

## Task 6: Server — Bootstrap + Smoke Test

**Files:**
- Create: `server/src/index.ts`

- [ ] **Step 1: Buat `server/src/index.ts`**

```ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { chatRoutes } from './routes/chat.js';

const app = Fastify({ logger: false });

await app.register(cors, {
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'DELETE'],
});

await app.register(chatRoutes);

await app.listen({ port: 3000, host: '0.0.0.0' });
console.log('Mapro server → http://localhost:3000');
```

- [ ] **Step 2: Jalankan server dan smoke test endpoint**

```bash
cd server && npm run dev &
sleep 2
curl -s http://localhost:3000/api/history
```

Expected: `[]` atau array JSON dari history.

```bash
curl -s -X DELETE http://localhost:3000/api/history
```

Expected: `{"ok":true}`

- [ ] **Step 3: Kill server background process**

```bash
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat: bootstrap Fastify server"
```

---

## Task 7: Client — Scaffold

**Files:**
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`

- [ ] **Step 1: Buat `client/package.json`**

```json
{
  "name": "mapro-client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Buat `client/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Buat `client/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

- [ ] **Step 4: Buat `client/index.html`**

```html
<!DOCTYPE html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mapro</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧠</text></svg>" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Install dependencies**

```bash
cd client && npm install
```

Expected: node_modules terbuat.

- [ ] **Step 6: Commit**

```bash
git add client/
git commit -m "feat: scaffold client package"
```

---

## Task 8: Client — Global Styles (Glassmorphism)

**Files:**
- Create: `client/src/index.css`

- [ ] **Step 1: Buat `client/src/index.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:              #07070f;
  --glass-bg:        rgba(255, 255, 255, 0.04);
  --glass-bg-hover:  rgba(255, 255, 255, 0.07);
  --glass-border:    rgba(255, 255, 255, 0.08);
  --blur:            20px;
  --text:            rgba(255, 255, 255, 0.92);
  --text-dim:        rgba(255, 255, 255, 0.45);
  --text-faint:      rgba(255, 255, 255, 0.25);
  --accent:          #2563eb;
  --accent-hover:    #3b82f6;
  --user-tint:       rgba(37, 99, 235, 0.15);
  --radius:          14px;
}

html, body, #root {
  height: 100%;
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--text);
  background: var(--bg);
  overflow: hidden;
}

/* ── Background gradient blobs ────────────────────────────────── */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse at 15% 15%, rgba(108, 63, 196, 0.18) 0%, transparent 55%),
    radial-gradient(ellipse at 85% 80%, rgba(37, 99, 235, 0.14) 0%, transparent 55%),
    radial-gradient(ellipse at 65% 5%,  rgba(13, 148, 136, 0.10) 0%, transparent 40%);
  pointer-events: none;
  z-index: 0;
}

/* ── Layout ────────────────────────────────────────────────────── */
.app {
  display: flex;
  height: 100%;
  position: relative;
  z-index: 1;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* ── Sidebar ───────────────────────────────────────────────────── */
.sidebar {
  width: 260px;
  flex-shrink: 0;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--blur));
  -webkit-backdrop-filter: blur(var(--blur));
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  padding: 28px 18px 20px;
  gap: 8px;
}

.sidebar-header { margin-bottom: auto; }

.logo {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: rgba(255,255,255,0.95);
}

.tagline {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 5px;
  letter-spacing: 0.04em;
}

.divider {
  height: 1px;
  background: var(--glass-border);
  margin: 16px 0;
}

.reset-btn {
  width: 100%;
  padding: 9px 14px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  color: var(--text-dim);
  font-size: 12px;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
  letter-spacing: 0.02em;
}
.reset-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--text);
}

/* Mobile sidebar toggle */
.sidebar-toggle {
  display: none;
  position: fixed;
  top: 14px;
  left: 14px;
  z-index: 200;
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  padding: 8px 11px;
  color: var(--text);
  font-size: 15px;
  cursor: pointer;
  line-height: 1;
}

.sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 40;
  backdrop-filter: blur(2px);
}

/* ── Chat window ────────────────────────────────────────────────── */
.chat-window {
  flex: 1;
  overflow-y: auto;
  padding: 36px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  scroll-behavior: smooth;
}

.chat-window::-webkit-scrollbar { width: 4px; }
.chat-window::-webkit-scrollbar-track { background: transparent; }
.chat-window::-webkit-scrollbar-thumb { background: var(--glass-border); border-radius: 4px; }

/* Empty state */
.empty-state {
  margin: auto;
  text-align: center;
  padding: 40px 20px;
}
.empty-state h2 {
  font-size: 26px;
  font-weight: 400;
  letter-spacing: -0.02em;
  margin-bottom: 10px;
  color: rgba(255,255,255,0.85);
}
.empty-state p {
  font-size: 14px;
  color: var(--text-dim);
  line-height: 1.6;
}

/* ── Messages ───────────────────────────────────────────────────── */
.msg-wrapper {
  display: flex;
  flex-direction: column;
  max-width: 700px;
  width: 100%;
}
.msg-wrapper.user      { align-self: flex-end;  align-items: flex-end; }
.msg-wrapper.assistant { align-self: flex-start; align-items: flex-start; }

.bubble {
  padding: 13px 18px;
  border-radius: var(--radius);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  font-size: 14.5px;
  line-height: 1.65;
  max-width: 100%;
  word-break: break-word;
}
.bubble-user {
  background: var(--user-tint);
  border-radius: var(--radius) var(--radius) 3px var(--radius);
}
.bubble-assistant {
  background: var(--glass-bg);
  border-radius: var(--radius) var(--radius) var(--radius) 3px;
}

.mapro-label {
  display: block;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: var(--text-faint);
  margin-bottom: 7px;
  text-transform: uppercase;
}

.cursor {
  display: inline-block;
  animation: blink 0.75s step-end infinite;
  color: var(--text-dim);
}
@keyframes blink { 50% { opacity: 0; } }

/* ── Reasoning block ───────────────────────────────────────────── */
.reasoning-block { margin-bottom: 8px; width: 100%; }

.reasoning-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-faint);
  font-size: 10.5px;
  font-family: 'JetBrains Mono', monospace;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  letter-spacing: 0.04em;
  gap: 8px;
}
.reasoning-toggle:hover { background: var(--glass-bg); color: var(--text-dim); }
.reasoning-toggle-label { display: flex; align-items: center; gap: 6px; }
.reasoning-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--text-faint);
  flex-shrink: 0;
}
.reasoning-dot.streaming { background: #0d9488; animation: pulse 1s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

.reasoning-body {
  margin-top: 4px;
  padding: 10px 14px;
  background: rgba(255,255,255,0.015);
  border-left: 2px solid rgba(255,255,255,0.08);
  border-radius: 0 0 8px 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  color: rgba(255,255,255,0.3);
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 280px;
  overflow-y: auto;
}
.reasoning-body::-webkit-scrollbar { width: 3px; }
.reasoning-body::-webkit-scrollbar-thumb { background: var(--glass-border); border-radius: 3px; }

/* ── Input bar ─────────────────────────────────────────────────── */
.input-bar {
  padding: 14px 24px 18px;
  border-top: 1px solid var(--glass-border);
  background: rgba(7, 7, 15, 0.85);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.input-textarea {
  flex: 1;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 11px 15px;
  color: var(--text);
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  min-height: 44px;
  max-height: 160px;
  overflow-y: auto;
  transition: border-color 0.2s;
}
.input-textarea::placeholder { color: var(--text-faint); }
.input-textarea:focus { border-color: rgba(37, 99, 235, 0.45); }
.input-textarea:disabled { opacity: 0.45; cursor: not-allowed; }

.send-btn {
  width: 44px;
  height: 44px;
  background: rgba(37, 99, 235, 0.85);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 17px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, transform 0.1s;
}
.send-btn:hover:not(:disabled) { background: var(--accent-hover); }
.send-btn:active:not(:disabled) { transform: scale(0.95); }
.send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.send-btn.streaming { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Responsive ────────────────────────────────────────────────── */
@media (max-width: 767px) {
  .sidebar {
    position: fixed;
    left: -270px;
    top: 0;
    height: 100%;
    z-index: 100;
    transition: left 0.25s ease;
    width: 260px;
  }
  .sidebar.open { left: 0; }
  .sidebar-overlay.visible { display: block; }
  .sidebar-toggle { display: flex; align-items: center; }
  .chat-window { padding: 20px 16px; padding-top: 60px; }
  .input-bar { padding: 10px 12px 14px; }
  .msg-wrapper { max-width: 100%; }
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/index.css
git commit -m "feat: add glassmorphism global styles"
```

---

## Task 9: Client — Types + useChat Hook

**Files:**
- Create: `client/src/types.ts`
- Create: `client/src/hooks/useChat.ts`

- [ ] **Step 1: Buat `client/src/types.ts`**

```ts
export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning: string;
  isStreaming: boolean;
}
```

- [ ] **Step 2: Buat `client/src/hooks/useChat.ts`**

```ts
import { useState, useCallback } from 'react';
import type { DisplayMessage } from '../types';

const API = 'http://localhost:3000';

export function useChat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      reasoning: '',
      isStreaming: false,
    };

    const assistantId = crypto.randomUUID();
    const assistantMsg: DisplayMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      reasoning: '',
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      const response = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const patch = (fn: (m: DisplayMessage) => DisplayMessage) =>
        setMessages(prev => prev.map(m => m.id === assistantId ? fn(m) : m));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType) {
            const data = JSON.parse(line.slice(6)) as Record<string, string>;
            if (eventType === 'reasoning') {
              patch(m => ({ ...m, reasoning: m.reasoning + (data.text ?? '') }));
            } else if (eventType === 'token') {
              patch(m => ({ ...m, content: m.content + (data.text ?? '') }));
            } else if (eventType === 'done' || eventType === 'error') {
              const errMsg = eventType === 'error' ? (data.message ?? 'Error') : undefined;
              patch(m => ({
                ...m,
                isStreaming: false,
                content: errMsg ? `⚠ ${errMsg}` : m.content,
              }));
            }
            eventType = '';
          }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: '⚠ Gagal terhubung ke server.', isStreaming: false }
          : m
      ));
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming]);

  const resetHistory = useCallback(async () => {
    await fetch(`${API}/api/history`, { method: 'DELETE' });
    setMessages([]);
  }, []);

  return { messages, isStreaming, sendMessage, resetHistory };
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/types.ts client/src/hooks/useChat.ts
git commit -m "feat: add DisplayMessage type and useChat hook"
```

---

## Task 10: Client — Komponen Atom

**Files:**
- Create: `client/src/components/ReasoningBlock.tsx`
- Create: `client/src/components/MessageBubble.tsx`
- Create: `client/src/components/InputBar.tsx`

- [ ] **Step 1: Buat `client/src/components/ReasoningBlock.tsx`**

```tsx
import { useState } from 'react';

interface Props {
  text: string;
  isStreaming: boolean;
}

export function ReasoningBlock({ text, isStreaming }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!text && !isStreaming) return null;

  return (
    <div className="reasoning-block">
      <button className="reasoning-toggle" onClick={() => setExpanded(e => !e)}>
        <span className="reasoning-toggle-label">
          <span className={`reasoning-dot ${isStreaming ? 'streaming' : ''}`} />
          {isStreaming ? 'Berpikir...' : 'Proses berpikir'}
        </span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && text && (
        <pre className="reasoning-body">{text}</pre>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Buat `client/src/components/MessageBubble.tsx`**

```tsx
import { ReasoningBlock } from './ReasoningBlock';
import type { DisplayMessage } from '../types';

interface Props { message: DisplayMessage; }

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  return (
    <div className={`msg-wrapper ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && (
        <ReasoningBlock text={message.reasoning} isStreaming={message.isStreaming} />
      )}
      <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-assistant'}`}>
        {!isUser && <span className="mapro-label">Mapro</span>}
        <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        {message.isStreaming && !message.content && (
          <span className="cursor">▍</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Buat `client/src/components/InputBar.tsx`**

```tsx
import { useState, useRef, type KeyboardEvent } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function InputBar({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    if (ref.current) ref.current.style.height = 'auto';
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const onInput = () => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  };

  return (
    <div className="input-bar">
      <textarea
        ref={ref}
        className="input-textarea"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onInput={onInput}
        placeholder="Tulis pesan…  (Enter kirim · Shift+Enter baris baru)"
        disabled={disabled}
        rows={1}
      />
      <button
        className={`send-btn${disabled ? ' streaming' : ''}`}
        onClick={submit}
        disabled={disabled || !value.trim()}
        title="Kirim"
      >
        {disabled ? '↻' : '↑'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ReasoningBlock.tsx client/src/components/MessageBubble.tsx client/src/components/InputBar.tsx
git commit -m "feat: add ReasoningBlock, MessageBubble, InputBar components"
```

---

## Task 11: Client — Sidebar + ChatWindow + App + main.tsx

**Files:**
- Create: `client/src/components/Sidebar.tsx`
- Create: `client/src/components/ChatWindow.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/main.tsx`

- [ ] **Step 1: Buat `client/src/components/Sidebar.tsx`**

```tsx
interface Props {
  onReset: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ onReset, isOpen, onToggle }: Props) {
  return (
    <>
      <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
        ☰
      </button>
      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onToggle}
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">MAPRO</div>
          <div className="tagline">AI Debater · Bahasa Indonesia</div>
        </div>
        <div className="divider" />
        <button className="reset-btn" onClick={onReset}>
          ↺ &nbsp;Reset percakapan
        </button>
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Buat `client/src/components/ChatWindow.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import type { DisplayMessage } from '../types';

interface Props {
  messages: DisplayMessage[];
}

export function ChatWindow({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-window">
      {messages.length === 0 && (
        <div className="empty-state">
          <h2>Hai, saya Mapro.</h2>
          <p>Saya tidak akan selalu setuju dengan kamu.<br />Bicara saja.</p>
        </div>
      )}
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 3: Buat `client/src/App.tsx`**

```tsx
import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { InputBar } from './components/InputBar';
import { useChat } from './hooks/useChat';

export default function App() {
  const { messages, isStreaming, sendMessage, resetHistory } = useChat();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app">
      <Sidebar
        onReset={resetHistory}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />
      <main className="main">
        <ChatWindow messages={messages} />
        <InputBar onSend={sendMessage} disabled={isStreaming} />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Buat `client/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 5: Verifikasi client build tidak ada error TypeScript**

```bash
cd client && npx tsc --noEmit
```

Expected: no output (no errors).

- [ ] **Step 6: Commit**

```bash
git add client/src/
git commit -m "feat: add Sidebar, ChatWindow, App, main — client complete"
```

---

## Task 12: start.sh + Integration Test

**Files:**
- Create: `start.sh`

- [ ] **Step 1: Buat `start.sh` di root project**

```bash
#!/bin/bash
set -e
trap 'echo ""; echo "Shutting down..."; kill 0' EXIT INT TERM

echo "▶  Starting Mapro backend  → http://localhost:3000"
(cd server && npm run dev) &

echo "▶  Starting Mapro frontend → http://localhost:5173"
(cd client && npm run dev) &

echo ""
echo "✓  Mapro is running. Open http://localhost:5173"
echo "   Ctrl+C to stop both."
echo ""

wait
```

- [ ] **Step 2: Buat executable**

```bash
chmod +x start.sh
```

- [ ] **Step 3: Jalankan dan test end-to-end**

```bash
./start.sh
```

Buka browser ke `http://localhost:5173`. Lakukan:
1. Ketik pesan → pastikan muncul di UI
2. Tunggu respons streaming → pastikan teks muncul kata per kata
3. Click "Proses berpikir" → pastikan reasoning accordion expand
4. Resize ke mobile (`< 768px`) → pastikan sidebar jadi drawer
5. Ctrl+C → pastikan kedua proses berhenti

- [ ] **Step 4: Commit**

```bash
git add start.sh
git commit -m "feat: add start.sh to run server and client together"
```

---

## Checklist Akhir

- [ ] `npm test` di root (API tests) → semua pass
- [ ] `npm test` di `server/` (history tests) → semua pass
- [ ] `./start.sh` → kedua service berjalan
- [ ] Browser: chat berfungsi dengan streaming
- [ ] Browser: reasoning block collapsible
- [ ] Browser: reset percakapan berhasil
- [ ] Mobile: sidebar toggle berfungsi
- [ ] CLI: `npm run chat` di root masih berfungsi
