import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearAuthCookie } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  clearAuthCookie(res);
  return res.json({ ok: true });
}
