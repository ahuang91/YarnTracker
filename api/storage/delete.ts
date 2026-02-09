import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db/index.js';
import { kvStore } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ error: 'Missing key' });
  }

  await db.delete(kvStore).where(eq(kvStore.key, key));

  return res.json({ ok: true });
}
