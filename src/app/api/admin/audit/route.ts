import { getSessionCookie, getSession } from '@/lib/auth';
import { getDbFromRequest } from '@/lib/api-helpers';

export async function GET(request: Request) {
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const sessionId = getSessionCookie(request);
  const user = sessionId ? await getSession(db, sessionId) : null;
  if (!user || user.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: '权限不足' } }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = 50;
  const offset = (page - 1) * limit;

  const result = await db.all(
    `SELECT r.*, u.name as reviewer_name FROM review_logs r LEFT JOIN users u ON r.reviewer_user_id = u.id ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  return Response.json({ data: result.results || [] });
}
