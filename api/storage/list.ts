import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db/index.js';
import { kvStore } from '../../src/db/schema.js';
import { like } from 'drizzle-orm';
import { requireAuth } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const prefix = (req.query.prefix as string) ?? '';
  const scopedPrefix = `user:${user.userId}:${prefix}`;
  const rows = await db
    .select({ key: kvStore.key })
    .from(kvStore)
    .where(like(kvStore.key, `${scopedPrefix}%`));

  const userPrefix = `user:${user.userId}:`;
  return res.json({ keys: rows.map((r) => r.key.slice(userPrefix.length)) });
}
