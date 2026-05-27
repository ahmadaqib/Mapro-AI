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
