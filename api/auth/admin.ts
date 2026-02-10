import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, hashPassword } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (!user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const action =
    req.method === 'GET'
      ? (req.query.action as string)
      : req.body?.action;

  if (req.method === 'GET' && action === 'users') {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
      })
      .from(users);

    return res.json({ users: rows });
  }

  if (req.method === 'POST' && action === 'toggle-admin') {
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

  if (req.method === 'POST' && action === 'reset-password') {
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

  return res.status(400).json({ error: 'Invalid action' });
}
