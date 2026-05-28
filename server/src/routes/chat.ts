import type { FastifyInstance } from 'fastify';
import {
  appendHistory,
  createStoredConversation,
  deleteConversation,
  ensureConversation,
  getConversation,
  listConversations,
  loadHistory,
  resetHistory,
} from '../services/history.js';
import { streamMapro } from '../services/agent.js';
import { extractTextFromFile } from '../services/fileExtract.js';
import type { ChatRequest, FileContext } from '../types.js';

function withFileContext(message: string, fileContext?: FileContext): string {
  if (!fileContext?.text.trim()) return message;

  return `${message}

[KONTEKS FILE TERLAMPIR]
Nama file: ${fileContext.name}
Isi teks:
${fileContext.text}
[/KONTEKS FILE TERLAMPIR]`;
}

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.get('/api/history', async () => {
    return loadHistory();
  });

  fastify.delete<{ Querystring: { conversationId?: string } }>('/api/history', async request => {
    resetHistory(request.query.conversationId);
    return { ok: true };
  });

  fastify.get('/api/conversations', async () => {
    return listConversations();
  });

  fastify.post('/api/conversations', async () => {
    return createStoredConversation();
  });

  fastify.get<{ Params: { id: string } }>('/api/conversations/:id', async (request, reply) => {
    const conversation = getConversation(request.params.id);
    if (!conversation) {
      reply.code(404);
      return { message: 'Conversation not found' };
    }

    return conversation;
  });

  fastify.delete<{ Params: { id: string } }>('/api/conversations/:id', async (request, reply) => {
    const deleted = deleteConversation(request.params.id);
    if (!deleted) {
      reply.code(404);
      return { message: 'Conversation not found' };
    }

    return { ok: true };
  });

  fastify.post('/api/files/extract', async (request, reply) => {
    try {
      const file = await request.file();
      if (!file) {
        reply.code(400);
        return { message: 'File wajib diunggah.' };
      }

      const buffer = await file.toBuffer();
      return await extractTextFromFile(file.filename, file.mimetype, buffer);
    } catch (err) {
      reply.code(400);
      return {
        message: err instanceof Error ? err.message : 'Gagal membaca file.',
      };
    }
  });

  fastify.post<{ Body: ChatRequest }>('/api/chat', async (request, reply) => {
    const { message, conversationId, history = [], private: isPrivate, fileContext } = request.body;

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': 'http://localhost:5173',
    });

    const send = (event: string, data: object) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const conversation = isPrivate ? null : ensureConversation(conversationId);
    const previousMessages = conversation?.messages ?? history;
    const modelMessage = withFileContext(message, fileContext);

    const { content, reasoning } = await streamMapro(previousMessages, modelMessage, (type, text) => {
      if (type === 'reasoning') send('reasoning', { text });
      else if (type === 'token')   send('token',     { text });
      else if (type === 'done')    send('done',      {});
      else if (type === 'error')   send('error',     { message: text });
    });

    if (!isPrivate && conversation) {
      const updatedConversation = appendHistory(message, content || reasoning, conversation.id);
      send('conversation', {
        id: updatedConversation.id,
        title: updatedConversation.title,
        updatedAt: updatedConversation.updatedAt,
        messageCount: updatedConversation.messages.length,
        preview: (content || reasoning).replace(/\s+/g, ' ').slice(0, 80),
      });
    }

    reply.raw.end();
  });
}
