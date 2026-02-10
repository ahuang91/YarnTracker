import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db/index.js';
import { kvStore } from '../src/db/schema.js';
import { eq, like } from 'drizzle-orm';
import { requireAuth } from './lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const action =
    req.method === 'GET'
      ? (req.query.action as string)
      : req.body?.action;

  if (req.method === 'GET' && action === 'get') {
    const key = req.query.key as string;
    if (!key) {
      return res.status(400).json({ error: 'Missing key parameter' });
    }

    const scopedKey = `user:${user.userId}:${key}`;
    const rows = await db
      .select({ value: kvStore.value })
      .from(kvStore)
      .where(eq(kvStore.key, scopedKey));

    return res.json({ value: rows.length > 0 ? rows[0].value : null });
  }

  if (req.method === 'GET' && action === 'list') {
    const prefix = (req.query.prefix as string) ?? '';
    const scopedPrefix = `user:${user.userId}:${prefix}`;
    const rows = await db
      .select({ key: kvStore.key })
      .from(kvStore)
      .where(like(kvStore.key, `${scopedPrefix}%`));

    const userPrefix = `user:${user.userId}:`;
    return res.json({ keys: rows.map((r) => r.key.slice(userPrefix.length)) });
  }

  if (req.method === 'POST' && action === 'set') {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Missing key or value' });
    }

    const scopedKey = `user:${user.userId}:${key}`;
    await db
      .insert(kvStore)
      .values({ key: scopedKey, value })
      .onConflictDoUpdate({ target: kvStore.key, set: { value } });

    return res.json({ ok: true });
  }

  if (req.method === 'POST' && action === 'delete') {
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'Missing key' });
    }

    const scopedKey = `user:${user.userId}:${key}`;
    await db.delete(kvStore).where(eq(kvStore.key, scopedKey));

    return res.json({ ok: true });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
