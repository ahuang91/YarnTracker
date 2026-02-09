import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../../src/db/index.js';
import { users } from '../../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, hashPassword } from '../../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  if (!user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { username, newPassword } = req.body;

  if (!username || !newPassword) {
    return res.status(400).json({ error: 'Username and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username));

  if (rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, rows[0].id));

  return res.json({ ok: true });
}
