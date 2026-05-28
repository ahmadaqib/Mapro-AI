import type { FastifyInstance } from 'fastify';
import {
  appendHistory,
  createStoredConversation,
  ensureConversation,
  getConversation,
  listConversations,
  loadHistory,
  resetHistory,
} from '../services/history.js';
import { streamMapro } from '../services/agent.js';
import type { ChatRequest } from '../types.js';

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

  fastify.post<{ Body: ChatRequest }>('/api/chat', async (request, reply) => {
    const { message, conversationId, history = [], private: isPrivate } = request.body;

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
    const previousMessages = isPrivate ? history : conversation.messages;

    const { content, reasoning } = await streamMapro(previousMessages, message, (type, text) => {
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
