import { createSession, hashPassword, verifyTurnstile, setSessionCookie } from '@/lib/auth';
import { getDbFromRequest } from '@/lib/api-helpers';

export async function POST(request: Request) {
  const env = process.env;
  const body = await request.json();
  const { email, password, name, turnstileToken } = body;

  if (!email || !password || !name) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: '邮箱、密码和名称必填' } }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: '密码至少 8 位' } }, { status: 400 });
  }

  // Turnstile verification (skip in dev if no key)
  if (env.TURNSTILE_SECRET_KEY && turnstileToken) {
    const valid = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY);
    if (!valid) {
      return Response.json({ error: { code: 'FORBIDDEN', message: '人机验证失败' } }, { status: 403 });
    }
  }

  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  // Check duplicate email
  const existing = await db.all(`SELECT id FROM users WHERE email = ?`, [email.toLowerCase().trim()]);
  if (existing.results?.length) {
    return Response.json({ error: { code: 'CONFLICT', message: '该邮箱已注册' } }, { status: 409 });
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO users (id, email, email_verified, password_hash, name, role, created_at, updated_at) VALUES (?, ?, 0, ?, ?, 'user', ?, ?)`,
    [userId, email.toLowerCase().trim(), passwordHash, name.trim(), now, now]
  );

  const sessionId = await createSession(db, userId);

  return new Response(JSON.stringify({ data: { userId, name: name.trim() } }), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': setSessionCookie(sessionId),
    },
  });
}
