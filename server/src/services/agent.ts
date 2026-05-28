import OpenAI from 'openai';
import type { Message, SseEventType } from '../types.js';
import { MAPRO_MODEL, buildMaproSystemPrompt } from '../../../personality/personality.js';

const API_KEY = process.env.MIMO_API_KEY;
if (!API_KEY) throw new Error('MIMO_API_KEY environment variable is required');

const client = new OpenAI({
  apiKey: API_KEY,
  baseURL: 'https://api.xiaomimimo.com/v1',
});

const SYSTEM_PROMPT = buildMaproSystemPrompt({ markdown: true });

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
      model: MAPRO_MODEL,
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
    console.error('streamMapro failed:', err);
    onChunk('error', 'Upstream model request failed');
  }

  return { content, reasoning };
}
