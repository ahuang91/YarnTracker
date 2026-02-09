import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword, createToken, setAuthCookie } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password, securityQuestion, securityAnswer } = req.body;

  if (!username || !password || !securityQuestion || !securityAnswer) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (username.length < 3 || username.length > 30 || !/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-30 characters (letters, numbers, underscores)' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username));

  if (existing.length > 0) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const securityAnswerHash = await hashPassword(securityAnswer.toLowerCase().trim());
  const isAdmin = process.env.ADMIN_USERNAME === username;

  await db.insert(users).values({
    id,
    username,
    passwordHash,
    securityQuestion,
    securityAnswerHash,
    isAdmin,
  });

  const token = await createToken({ userId: id, username, isAdmin });
  setAuthCookie(res, token);

  return res.json({ user: { id, username, isAdmin } });
}
