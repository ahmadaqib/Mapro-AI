import OpenAI from "openai";
import readline from "readline";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MAPRO_MODEL, buildMaproSystemPrompt } from "./personality/personality.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.join(__dirname, "history.json");
const API_KEY = process.env.MIMO_API_KEY;
if (!API_KEY) { console.error("Error: MIMO_API_KEY environment variable is required"); process.exit(1); }
const MODEL = MAPRO_MODEL;
const SYSTEM_PROMPT = buildMaproSystemPrompt();

// ── ANSI ─────────────────────────────────────────────────────────────────────
const c = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  italic:  "\x1b[3m",
  cyan:    "\x1b[36m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  red:     "\x1b[31m",
  gray:    "\x1b[90m",
  magenta: "\x1b[35m",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type Role = "user" | "assistant";
type Message = { role: Role; content: string };

// ── History ───────────────────────────────────────────────────────────────────
function loadHistory(): Message[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
      if (Array.isArray(parsed)) return parsed as Message[];
    }
  } catch {
    console.log(`${c.yellow}⚠  History rusak — direset otomatis.${c.reset}\n`);
  }
  return [];
}

function saveHistory(history: Message[]) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
}

// ── API ───────────────────────────────────────────────────────────────────────
const client = new OpenAI({ apiKey: API_KEY, baseURL: "https://api.xiaomimimo.com/v1" });

async function askMapro(history: Message[], userInput: string) {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: userInput },
    ],
    max_completion_tokens: 1024,
  });

  const msg = response.choices[0].message as unknown as Record<string, unknown>;
  return {
    content:   (msg.content as string)           ?? "",
    reasoning: (msg.reasoning_content as string) ?? "",
  };
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function printBanner() {
  console.clear();
  console.log(`${c.bold}${c.cyan}`);
  console.log("  ███╗   ███╗ █████╗ ██████╗ ██████╗  ██████╗ ");
  console.log("  ████╗ ████║██╔══██╗██╔══██╗██╔══██╗██╔═══██╗");
  console.log("  ██╔████╔██║███████║██████╔╝██████╔╝██║   ██║");
  console.log("  ██║╚██╔╝██║██╔══██║██╔═══╝ ██╔══██╗██║   ██║");
  console.log("  ██║ ╚═╝ ██║██║  ██║██║     ██║  ██║╚██████╔╝");
  console.log("  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝ ╚═════╝ ");
  console.log(`${c.reset}`);
  console.log(`  ${c.gray}Model  : ${MODEL}${c.reset}`);
  console.log(`  ${c.gray}Perintah: ${c.bold}/reset${c.reset}${c.gray}  /history  /exit${c.reset}`);
  console.log(`  ${c.gray}${"─".repeat(46)}${c.reset}\n`);
}

function printReasoning(text: string) {
  const lines = text.split("\n");
  const shown = lines.slice(0, 25);
  const truncated = lines.length > 25;

  console.log(`\n${c.dim}${c.gray}  ┌─ Mapro berpikir ` + "─".repeat(28) + `┐${c.reset}`);
  shown.forEach((line) =>
    console.log(`${c.dim}${c.gray}  │ ${line.slice(0, 72)}${c.reset}`)
  );
  if (truncated) console.log(`${c.dim}${c.gray}  │ …(dipotong)${c.reset}`);
  console.log(`${c.dim}${c.gray}  └` + "─".repeat(47) + `┘${c.reset}\n`);
}

function printResponse(text: string) {
  // word-wrap sederhana pada 72 karakter
  const words = text.split(" ");
  let line = `  ${c.cyan}${c.bold}Mapro${c.reset}: `;
  const indent = "          ";
  let first = true;

  for (const word of words) {
    const raw = line.replace(/\x1b\[[0-9;]*m/g, "");
    if (!first && raw.length + word.length > 78) {
      console.log(line);
      line = indent + word;
    } else {
      line += (first ? "" : " ") + word;
      first = false;
    }
  }
  if (line.trim()) console.log(line);
  console.log();
}

// ── Commands ──────────────────────────────────────────────────────────────────
function handleHistory(history: Message[]) {
  if (history.length === 0) {
    console.log(`\n  ${c.gray}(Belum ada history)${c.reset}\n`);
    return;
  }
  const preview = history.slice(-10);
  console.log(`\n  ${c.gray}── History terakhir (${preview.length} dari ${history.length} pesan) ──${c.reset}`);
  preview.forEach((m) => {
    const label = m.role === "user"
      ? `${c.green}${c.bold}Kamu ${c.reset}`
      : `${c.cyan}${c.bold}Mapro${c.reset}`;
    const text = m.content.replace(/\n/g, " ").slice(0, 70);
    console.log(`  ${label}${c.gray}: ${text}${m.content.length > 70 ? "…" : ""}${c.reset}`);
  });
  console.log();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  printBanner();

  const history = loadHistory();

  if (history.length > 0) {
    console.log(`  ${c.gray}↩  Melanjutkan sesi sebelumnya — ${history.length} pesan tersimpan.${c.reset}\n`);
  } else {
    console.log(`  ${c.gray}Sesi baru dimulai. Ketik apa saja untuk mulai bicara dengan Mapro.${c.reset}\n`);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt = () => {
    rl.question(`  ${c.green}${c.bold}Kamu${c.reset}: `, async (raw) => {
      const input = raw.trim();

      if (!input) { prompt(); return; }

      // ── commands ──
      if (input === "/exit") {
        console.log(`\n  ${c.cyan}Mapro${c.reset}: Sampai lain kali.\n`);
        rl.close();
        return;
      }

      if (input === "/reset") {
        history.length = 0;
        saveHistory([]);
        console.log(`\n  ${c.yellow}✓  History direset.${c.reset}\n`);
        prompt();
        return;
      }

      if (input === "/history") {
        handleHistory(history);
        prompt();
        return;
      }

      // ── API call ──
      process.stdout.write(`\n  ${c.gray}${c.italic}Mapro sedang berpikir…${c.reset}\n`);

      try {
        const { content, reasoning } = await askMapro(history, input);

        // hapus "sedang berpikir" line
        process.stdout.write("\x1b[1A\x1b[2K");

        if (reasoning) printReasoning(reasoning);

        const reply = content || reasoning;
        printResponse(reply);

        history.push({ role: "user",      content: input });
        history.push({ role: "assistant", content: reply });
        saveHistory(history);
      } catch (err: unknown) {
        process.stdout.write("\x1b[1A\x1b[2K");
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`\n  ${c.red}✗  Error: ${msg}${c.reset}\n`);
      }

      prompt();
    });
  };

  prompt();
}

main();
