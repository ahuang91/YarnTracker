import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { verifyPassword, hashPassword } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, securityAnswer, newPassword } = req.body;

  if (!username || !securityAnswer || !newPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const rows = await db.select().from(users).where(eq(users.username, username));

  if (rows.length === 0) {
    return res.status(400).json({ error: 'Unable to reset password' });
  }

  const user = rows[0];
  const valid = await verifyPassword(securityAnswer.toLowerCase().trim(), user.securityAnswerHash);

  if (!valid) {
    return res.status(400).json({ error: 'Incorrect security answer' });
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

  return res.json({ ok: true });
}
