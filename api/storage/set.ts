import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db/index.js';
import { kvStore } from '../../src/db/schema.js';
import { requireAuth } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'Missing key or value' });
  }

  const scopedKey = `user:${user.userId}:${key}`;
  await db
    .insert(kvStore)
    .values({ key: scopedKey, value })
    .onConflictDoUpdate({ target: kvStore.key, set: { value } });

  return res.json({ ok: true });
}
