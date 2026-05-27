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
