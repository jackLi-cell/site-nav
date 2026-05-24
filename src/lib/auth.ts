import { getDb } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const SESSION_COOKIE = 'session_id';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_REFRESH_THRESHOLD = 3 * 24 * 60 * 60 * 1000; // 3 days
const SESSION_COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE === undefined
  ? process.env.NODE_ENV === 'production'
  : !['false', '0', 'no'].includes(process.env.SESSION_COOKIE_SECURE.toLowerCase());

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'editor' | 'admin';
}

export async function createSession(db: any, userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE).toISOString();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
    [sessionId, userId, expiresAt, now]
  );

  return sessionId;
}

export async function getSession(db: any, sessionId: string): Promise<SessionUser | null> {
  if (!sessionId) return null;

  const result = await db.all(
    `SELECT s.id as session_id, s.expires_at, u.id, u.email, u.name, u.role
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.id = ? AND s.expires_at > ?`,
    [sessionId, new Date().toISOString()]
  );

  if (!result.results?.length) return null;

  const row = result.results[0];

  // Auto-refresh if close to expiry
  const expiresAt = new Date(row.expires_at).getTime();
  if (expiresAt - Date.now() < SESSION_REFRESH_THRESHOLD) {
    const newExpiry = new Date(Date.now() + SESSION_MAX_AGE).toISOString();
    await db.run(`UPDATE sessions SET expires_at = ? WHERE id = ?`, [newExpiry, sessionId]);
  }

  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export async function deleteSession(db: any, sessionId: string): Promise<void> {
  await db.run(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
}

export async function deleteExpiredSessions(db: any): Promise<void> {
  await db.run(`DELETE FROM sessions WHERE expires_at < ?`, [new Date().toISOString()]);
}

export function getSessionCookie(request: Request): string | null {
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

export function setSessionCookie(sessionId: string): string {
  const secureFlag = SESSION_COOKIE_SECURE ? '; Secure' : '';
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Strict${secureFlag}; Max-Age=${SESSION_MAX_AGE / 1000}`;
}

export function clearSessionCookie(): string {
  const secureFlag = SESSION_COOKIE_SECURE ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict${secureFlag}; Max-Age=0`;
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const computedHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computedHex === hashHex;
}

export async function verifyTurnstile(token: string, secretKey: string): Promise<boolean> {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
  });
  const data = await res.json() as any;
  return data.success === true;
}
