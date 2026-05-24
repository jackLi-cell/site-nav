import { getSessionCookie, getSession } from '@/lib/auth';
import { getDbFromRequest } from '@/lib/api-helpers';

export async function GET(request: Request) {
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = 50;
  const offset = (page - 1) * limit;

  const sessionId = getSessionCookie(request);
  const user = sessionId ? await getSession(db, sessionId) : null;
  if (!user || user.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: '权限不足' } }, { status: 403 });
  }

  let query = `SELECT s.*, u.name as submitter_name, u.email as submitter_email FROM submissions s LEFT JOIN users u ON s.user_id = u.id`;
  const params: any[] = [];

  if (status) {
    query += ` WHERE s.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const result = await db.all(query, params);

  return Response.json({ data: result.results || [] });
}
