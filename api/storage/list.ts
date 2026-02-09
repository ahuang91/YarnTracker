import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db/index.js';
import { kvStore } from '../../src/db/schema.js';
import { like } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const prefix = (req.query.prefix as string) ?? '';
  const rows = await db
    .select({ key: kvStore.key })
    .from(kvStore)
    .where(like(kvStore.key, `${prefix}%`));

  return res.json({ keys: rows.map((r) => r.key) });
}
