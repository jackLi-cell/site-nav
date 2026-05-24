import { createSession, verifyPassword, verifyTurnstile, setSessionCookie } from '@/lib/auth';
import { getDbFromRequest } from '@/lib/api-helpers';

type LoginUserRow = {
  id: string;
  password_hash: string;
  name: string;
  role: string;
};

export async function POST(request: Request) {
  const env = process.env;
  const body = await request.json();
  const { email, password, turnstileToken } = body;

  if (!email || !password) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: '邮箱和密码必填' } }, { status: 400 });
  }

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

  const result = await db.all<LoginUserRow>(
    `SELECT id, password_hash, name, role FROM users WHERE email = ?`,
    [email.toLowerCase().trim()]
  );

  if (!result.results?.length) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: '邮箱或密码错误' } }, { status: 401 });
  }

  const user = result.results[0];
  const valid = await verifyPassword(password, user.password_hash);

  if (!valid) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: '邮箱或密码错误' } }, { status: 401 });
  }

  const sessionId = await createSession(db, user.id);

  return new Response(JSON.stringify({ data: { userId: user.id, name: user.name, role: user.role } }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': setSessionCookie(sessionId),
    },
  });
}
