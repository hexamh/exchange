import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users Table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['user', 'admin', 'operator'] }).default('user'),
  referralCode: text('referral_code').unique(),
  referredBy: text('referred_by'),
  balanceUsd: real('balance_usd').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// Currencies & Gateways (e.g., bKash, USDT, Tron)
export const currencies = sqliteTable('currencies', {
  id: text('id').primaryKey(), // e.g., 'bkash_bdt', 'usdt_trc20'
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  type: text('type', { enum: ['fiat', 'crypto', 'mobile_money'] }).notNull(),
  buyRateUsd: real('buy_rate_usd').notNull(),  // Rate at which platform buys
  sellRateUsd: real('sell_rate_usd').notNull(), // Rate at which platform sells
  reserveAmount: real('reserve_amount').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});

// Exchange Transactions
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  sendCurrencyId: text('send_currency_id').references(() => currencies.id),
  receiveCurrencyId: text('receive_currency_id').references(() => currencies.id),
  sendAmount: real('send_amount').notNull(),
  receiveAmount: real('receive_amount').notNull(),
  exchangeRate: real('exchange_rate').notNull(),
  userSendWallet: text('user_send_wallet'), // Where user sends from (optional)
  userReceiveWallet: text('user_receive_wallet').notNull(), // Where user wants funds
  status: text('status', { 
    enum: ['pending', 'processing', 'completed', 'cancelled', 'refunded'] 
  }).default('pending'),
  txHash: text('tx_hash'), // Blockchain hash or TrxID
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});
