import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const userState = sqliteTable('user_state', {
  userId: text('user_id').primaryKey(),
  email: text('email').notNull(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull().default(1),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [index('idx_user_state_updated_at').on(table.updatedAt)]);
