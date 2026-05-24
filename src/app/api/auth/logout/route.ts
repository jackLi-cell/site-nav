import { getSessionCookie, deleteSession, clearSessionCookie } from '@/lib/auth';
import { getDbFromRequest } from '@/lib/api-helpers';

export async function POST(request: Request) {
  const sessionId = getSessionCookie(request);
  const db = getDbFromRequest(request);

  if (sessionId && db) {
    await deleteSession(db, sessionId);
  }

  return new Response(JSON.stringify({ data: { success: true } }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(),
    },
  });
}
