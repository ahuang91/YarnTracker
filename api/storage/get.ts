import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db/index.js';
import { kvStore } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = req.query.key as string;
  if (!key) {
    return res.status(400).json({ error: 'Missing key parameter' });
  }

  const rows = await db
    .select({ value: kvStore.value })
    .from(kvStore)
    .where(eq(kvStore.key, key));

  return res.json({ value: rows.length > 0 ? rows[0].value : null });
}
