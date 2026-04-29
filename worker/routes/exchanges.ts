import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { exchanges, gateways } from '../../src/db/schema';
import { Bindings } from '../index';

export const exchangeRouter = new Hono<{ Bindings: Bindings }>();

// Helper to generate an 8-digit reference ID
const generateRefId = () => Math.floor(10000000 + Math.random() * 90000000).toString();

// POST /api/v1/exchanges/initiate
exchangeRouter.post('/initiate', async (c) => {
  const db = drizzle(c.env.DB);
  const body = await c.req.json();
  
  const { userId, sendGatewayId, receiveGatewayId, sendAmount, userReceiveAccount } = body;

  if (!sendAmount || sendAmount <= 0) {
    return c.json({ success: false, error: 'Invalid send amount' }, 400);
  }

  try {
    // 1. Fetch current live rates for both gateways
    const [sendGateway, receiveGateway] = await Promise.all([
      db.select().from(gateways).where(eq(gateways.id, sendGatewayId)).get(),
      db.select().from(gateways).where(eq(gateways.id, receiveGatewayId)).get()
    ]);

    if (!sendGateway || !receiveGateway) {
      return c.json({ success: false, error: 'Invalid gateway selection' }, 400);
    }
    if (!sendGateway.isActive || !receiveGateway.isActive) {
      return c.json({ success: false, error: 'One or more gateways are currently offline' }, 403);
    }

    // 2. Perform Arbitrage/Exchange Calculation (Using USD as Base)
    // Formula: (Send Amount / Platform Buy Rate) * Platform Sell Rate
    const baseUsdValue = sendAmount / sendGateway.buyRate;
    const calculatedReceiveAmount = Number((baseUsdValue * receiveGateway.sellRate).toFixed(4));
    const effectiveRate = sendGateway.buyRate / receiveGateway.sellRate;

    // 3. Validate Platform Reserves
    if (calculatedReceiveAmount > receiveGateway.reserveAmount) {
      return c.json({ 
        success: false, 
        error: `Insufficient reserve. Maximum available is ${receiveGateway.reserveAmount} ${receiveGateway.symbol}` 
      }, 422);
    }

    const referenceId = generateRefId();

    // 4. Atomically insert the transaction
    const newExchange = await db.insert(exchanges).values({
      referenceId,
      userId,
      sendGatewayId,
      receiveGatewayId,
      sendAmount,
      receiveAmount: calculatedReceiveAmount,
      exchangeRateApplied: effectiveRate,
      userReceiveAccount,
      status: 'awaiting_payment'
    }).returning().get();

    return c.json({
      success: true,
      message: 'Exchange initiated successfully',
      data: {
        referenceId: newExchange.referenceId,
        sendAmount: newExchange.sendAmount,
        receiveAmount: newExchange.receiveAmount,
        status: newExchange.status,
        paymentInstructions: `Please transfer ${newExchange.sendAmount} ${sendGateway.symbol} and provide the TrxID.`
      }
    }, 201);

  } catch (error) {
    console.error('Exchange Initiation Error:', error);
    return c.json({ success: false, error: 'Failed to process exchange request' }, 500);
  }
});
