import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { serialize } from 'cookie';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const COOKIE_NAME = 'auth_token';
const MAX_AGE = 7 * 24 * 60 * 60; // 7 days
const IS_PROD = process.env.NODE_ENV === 'production';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

interface TokenPayload {
  userId: string;
  username: string;
  isAdmin: boolean;
}

export async function createToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ username: payload.username, isAdmin: payload.isAdmin })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.sub!,
      username: payload.username as string,
      isAdmin: payload.isAdmin as boolean,
    };
  } catch {
    return null;
  }
}

export function setAuthCookie(res: VercelResponse, token: string): void {
  res.setHeader(
    'Set-Cookie',
    serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_AGE,
    }),
  );
}

export function clearAuthCookie(res: VercelResponse): void {
  res.setHeader(
    'Set-Cookie',
    serialize(COOKIE_NAME, '', {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    }),
  );
}

export async function getAuthUser(req: VercelRequest): Promise<TokenPayload | null> {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse,
): Promise<TokenPayload | null> {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return user;
}
