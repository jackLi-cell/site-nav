import { getDb } from '@/db';

export function getDbFromRequest(request: Request) {
  void request;

  try {
    return getDb();
  } catch {
    return null;
  }
}

export function createEmptyResponse() {
  return Response.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
}

export function createErrorResponse(message: string, status = 500) {
  return Response.json({ error: { message } }, { status });
}
