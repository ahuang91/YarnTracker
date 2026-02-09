import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db/index.js';
import { kvStore } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const key = req.query.key as string;
  if (!key) {
    return res.status(400).json({ error: 'Missing key parameter' });
  }

  const scopedKey = `user:${user.userId}:${key}`;
  const rows = await db
    .select({ value: kvStore.value })
    .from(kvStore)
    .where(eq(kvStore.key, scopedKey));

  return res.json({ value: rows.length > 0 ? rows[0].value : null });
}
