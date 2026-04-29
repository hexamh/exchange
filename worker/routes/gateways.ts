import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { gateways } from '../../src/db/schema';
import { Bindings } from '../index';

export const gatewayRouter = new Hono<{ Bindings: Bindings }>();

// GET /api/v1/gateways/rates
gatewayRouter.get('/rates', async (c) => {
  const kv = c.env.CACHE_KV;
  const CACHE_KEY = 'active_gateway_rates';

  // 1. Attempt to serve from Edge KV Cache (Fastest)
  const cachedRates = await kv.get(CACHE_KEY, 'json');
  if (cachedRates) {
    return c.json({ success: true, source: 'cache', data: cachedRates });
  }

  // 2. Cache Miss: Fetch from D1
  const db = drizzle(c.env.DB);
  const activeGateways = await db.select({
    id: gateways.id,
    name: gateways.name,
    symbol: gateways.symbol,
    type: gateways.type,
    buyRate: gateways.buyRate,
    sellRate: gateways.sellRate,
    reserveAmount: gateways.reserveAmount,
    iconUrl: gateways.iconUrl
  })
  .from(gateways)
  .where(eq(gateways.isActive, true));

  // 3. Update Cache (TTL: 60 seconds to ensure fresh rates without DB strain)
  await kv.put(CACHE_KEY, JSON.stringify(activeGateways), { expirationTtl: 60 });

  return c.json({ success: true, source: 'db', data: activeGateways });
});
