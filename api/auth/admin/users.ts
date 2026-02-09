import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../../src/db/index.js';
import { users } from '../../../src/db/schema.js';
import { requireAuth } from '../../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  if (!user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

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
