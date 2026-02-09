import { pgTable, text } from 'drizzle-orm/pg-core';

export const kvStore = pgTable('kv_store', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
