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
