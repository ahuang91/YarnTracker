import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../../src/db/index.js';
import { users } from '../../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  if (!user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { userId, isAdmin } = req.body;

  if (!userId || typeof isAdmin !== 'boolean') {
    return res.status(400).json({ error: 'userId and isAdmin (boolean) are required' });
  }

  if (userId === user.userId && !isAdmin) {
    return res.status(400).json({ error: 'You cannot demote yourself' });
  }

  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId));

  if (rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  await db.update(users).set({ isAdmin }).where(eq(users.id, userId));

  return res.json({ ok: true });
}
