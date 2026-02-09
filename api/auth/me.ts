import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authUser = await getAuthUser(req);
  if (!authUser) {
    return res.json({ user: null });
  }

  const rows = await db
    .select({ id: users.id, username: users.username, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, authUser.userId));

  if (rows.length === 0) {
    return res.json({ user: null });
  }

  const user = rows[0];

  // Auto-promote if ADMIN_USERNAME matches but DB hasn't been updated yet
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_USERNAME === user.username && !user.isAdmin) {
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, user.id));
    user.isAdmin = true;
  }

  return res.json({ user });
}
