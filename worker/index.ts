import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { D1Database, KVNamespace } from '@cloudflare/workers-types';

// Import modular routes
import { exchangeRouter } from './routes/exchanges';
import { gatewayRouter } from './routes/gateways';
import { userRouter } from './routes/users';

export type Bindings = {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>().basePath('/api/v1');

// Global Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: ['https://dollarvaly.net', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health Check
app.get('/health', (c) => c.json({ status: 'operational', timestamp: Date.now() }));

// Mount Routers
app.route('/exchanges', exchangeRouter);
app.route('/gateways', gatewayRouter);
app.route('/users', userRouter);

export default app;
