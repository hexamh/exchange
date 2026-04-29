import { 
  sqliteTable, 
  text, 
  integer, 
  real, 
  index, 
  uniqueIndex 
} from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// --- USERS & AUTHENTICATION ---
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  role: text('role', { enum: ['user', 'operator', 'admin'] }).default('user').notNull(),
  
  // Balances & Referrals
  accountBalance: real('account_balance').default(0.0).notNull(),
  referralCode: text('referral_code').unique().notNull(),
  referredById: text('referred_by_id'), // Self-referencing foreign key concept
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('email_idx').on(table.email),
  referralIdx: uniqueIndex('referral_code_idx').on(table.referralCode),
}));

// --- PAYMENT GATEWAYS & CURRENCIES ---
export const gateways = sqliteTable('gateways', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(), // e.g., 'bKash Personal BDT', 'USDT (TRC20)'
  symbol: text('symbol').notNull(), // e.g., 'BDT', 'USDT'
  type: text('type', { enum: ['fiat', 'crypto', 'mobile_money', 'e_wallet'] }).notNull(),
  iconUrl: text('icon_url'),
  
  // Exchange Configuration (Pegged against a base USD value)
  buyRate: real('buy_rate').notNull(),   // What the platform pays to acquire 1 USD worth
  sellRate: real('sell_rate').notNull(), // What the platform charges to sell 1 USD worth
  reserveAmount: real('reserve_amount').default(0.0).notNull(),
  
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

// --- EXCHANGE TRANSACTIONS ---
export const exchanges = sqliteTable('exchanges', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  referenceId: text('reference_id').unique().notNull(), // e.g., '137376996' (User-friendly ID)
  userId: text('user_id').notNull().references(() => users.id),
  
  // Gateway Linkage
  sendGatewayId: text('send_gateway_id').notNull().references(() => gateways.id),
  receiveGatewayId: text('receive_gateway_id').notNull().references(() => gateways.id),
  
  // Amounts & Rates applied at the exact time of transaction
  sendAmount: real('send_amount').notNull(),
  receiveAmount: real('receive_amount').notNull(),
  exchangeRateApplied: real('exchange_rate_applied').notNull(),
  
  // User Payment Details
  userSendAccount: text('user_send_account'), // e.g., user's sending bKash number (optional)
  userReceiveAccount: text('user_receive_account').notNull(), // e.g., user's receiving Binance Pay ID
  transactionHash: text('transaction_hash'), // TrxID or Blockchain Hash verified by operator
  
  status: text('status', { 
    enum: ['awaiting_payment', 'processing', 'completed', 'cancelled', 'refunded'] 
  }).default('awaiting_payment').notNull(),
  
  processedBy: text('processed_by').references(() => users.id), // Operator who confirmed
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
  userExchangesIdx: index('user_exchanges_idx').on(table.userId),
  statusIdx: index('status_idx').on(table.status),
  refIdIdx: uniqueIndex('reference_id_idx').on(table.referenceId),
}));

// --- TESTIMONIALS & REVIEWS ---
export const testimonials = sqliteTable('testimonials', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id),
  exchangeId: text('exchange_id').unique().notNull().references(() => exchanges.id),
  rating: integer('rating').notNull(), // 1-5 scale
  feedback: text('feedback').notNull(),
  isApproved: integer('is_approved', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

// --- RELATIONS DEFINITIONS ---
export const usersRelations = relations(users, ({ many, one }) => ({
  exchanges: many(exchanges),
  testimonials: many(testimonials),
  referredBy: one(users, {
    fields: [users.referredById],
    references: [users.id],
    relationName: 'user_referrals'
  })
}));

export const exchangesRelations = relations(exchanges, ({ one }) => ({
  user: one(users, { fields: [exchanges.userId], references: [users.id] }),
  sendGateway: one(gateways, { fields: [exchanges.sendGatewayId], references: [gateways.id] }),
  receiveGateway: one(gateways, { fields: [exchanges.receiveGatewayId], references: [gateways.id] }),
  testimonial: one(testimonials, { fields: [exchanges.id], references: [testimonials.exchangeId] }),
}));
