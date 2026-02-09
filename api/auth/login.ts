import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { verifyPassword, createToken, setAuthCookie } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, username));

  if (rows.length === 0) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const user = rows[0];
  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Auto-promote if ADMIN_USERNAME matches but DB hasn't been updated yet
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_USERNAME === username && !user.isAdmin) {
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, user.id));
    user.isAdmin = true;
  }

  const token = await createToken({
    userId: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
  });
  setAuthCookie(res, token);

  return res.json({ user: { id: user.id, username: user.username, isAdmin: user.isAdmin } });
}
