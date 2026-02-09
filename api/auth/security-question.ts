import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const username = req.query.username as string;
  if (!username) {
    return res.status(400).json({ error: 'Missing username parameter' });
  }

  const rows = await db
    .select({ securityQuestion: users.securityQuestion })
    .from(users)
    .where(eq(users.username, username));

  return res.json({ question: rows.length > 0 ? rows[0].securityQuestion : null });
}
