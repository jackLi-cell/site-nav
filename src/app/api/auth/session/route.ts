import { getSessionCookie, getSession } from '@/lib/auth';
import { getDbFromRequest } from '@/lib/api-helpers';

export async function GET(request: Request) {
  const sessionId = getSessionCookie(request);

  if (!sessionId) {
    return Response.json({ data: null });
  }

  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ data: null });
  }

  const user = await getSession(db, sessionId);
  return Response.json({ data: user });
}
