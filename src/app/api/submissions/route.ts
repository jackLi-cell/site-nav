import { getSessionCookie, getSession, verifyTurnstile } from '@/lib/auth';
import { runModeration } from '@/lib/moderation';
import { normalizeUrl, extractDomain } from '@/lib/utils';
import { getDbFromRequest } from '@/lib/api-helpers';

type KeywordRow = {
  id: string;
};

type CountRow = {
  count: number;
};

export async function POST(request: Request) {
  const env = process.env;
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const sessionId = getSessionCookie(request);
  const user = sessionId ? await getSession(db, sessionId) : null;
  if (!user) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: '请先登录' } }, { status: 401 });
  }

  const body = await request.json();
  const { name, url, shortSummary, fullDescription, categoryIds, keywords, turnstileToken } = body;

  if (!name || !url || !shortSummary) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: '名称、URL 和简介必填' } }, { status: 400 });
  }

  if (env.TURNSTILE_SECRET_KEY && turnstileToken) {
    const valid = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY);
    if (!valid) {
      return Response.json({ error: { code: 'FORBIDDEN', message: '人机验证失败' } }, { status: 403 });
    }
  }

  let normalizedUrl: string;
  let domain: string;
  try {
    normalizedUrl = normalizeUrl(url);
    domain = extractDomain(url);
  } catch {
    return Response.json({ error: { code: 'BAD_REQUEST', message: 'URL 格式无效' } }, { status: 400 });
  }

  // Domain dedup check
  const existing = await db.all(
    `SELECT id FROM websites WHERE normalized_domain = ? AND status = 'active'`,
    [domain]
  );
  if (existing.results?.length) {
    return Response.json({ error: { code: 'CONFLICT', message: '该网站域名已被收录' } }, { status: 409 });
  }

  // Run moderation
  const checks = runModeration(url, name, shortSummary);
  const hasFailed = checks.some(c => !c.passed);
  const status = hasFailed ? 'auto_flagged' : 'queued';
  const flagReason = hasFailed ? checks.filter(c => !c.passed).map(c => c.detail).join('; ') : null;

  const submissionId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO submissions (id, user_id, name, url, normalized_domain, short_summary, full_description, status, flag_reason, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [submissionId, user.id, name.trim(), normalizedUrl, domain, shortSummary.trim(), fullDescription?.trim() || null, status, flagReason, now, now]
  );

  // Save moderation results
  for (const check of checks) {
    await db.run(
      `INSERT INTO moderation_results (id, submission_id, check_type, passed, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), submissionId, check.checkType, check.passed ? 1 : 0, check.detail, now]
    );
  }

  // Save category associations
  if (categoryIds?.length) {
    for (const catId of categoryIds) {
      await db.run(`INSERT INTO submission_categories (submission_id, category_id) VALUES (?, ?)`, [submissionId, catId]);
    }
  }

  // Save keyword associations
  if (keywords?.length) {
    for (const kwName of keywords) {
      const normalized = kwName.toLowerCase().trim().replace(/\s+/g, '');
      const existingKw = await db.all<KeywordRow>(`SELECT id FROM keywords WHERE normalized = ?`, [normalized]);
      let kwId: string;
      if (existingKw.results?.length) {
        kwId = existingKw.results[0].id;
      } else {
        kwId = crypto.randomUUID();
        await db.run(`INSERT INTO keywords (id, name, normalized, created_at) VALUES (?, ?, ?, ?)`, [kwId, kwName.trim(), normalized, now]);
      }
      await db.run(`INSERT INTO submission_keywords (submission_id, keyword_id) VALUES (?, ?)`, [submissionId, kwId]);
    }
  }

  return Response.json({ data: { id: submissionId, status } }, { status: 201 });
}

export async function GET(request: Request) {
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const sessionId = getSessionCookie(request);
  const user = sessionId ? await getSession(db, sessionId) : null;
  if (!user) {
    return Response.json({ error: { code: 'UNAUTHORIZED', message: '请先登录' } }, { status: 401 });
  }

  const result = await db.all(
    `SELECT id, name, url, short_summary, status, flag_reason, review_note, created_at FROM submissions WHERE user_id = ? ORDER BY created_at DESC`,
    [user.id]
  );

  // Get contribution score
  const approved = await db.all<CountRow>(
    `SELECT count(*) as count FROM submissions WHERE user_id = ? AND status = 'approved'`,
    [user.id]
  );

  return Response.json({
    data: result.results || [],
    stats: {
      total: (result.results || []).length,
      approved: approved.results?.[0]?.count || 0,
      contributionScore: approved.results?.[0]?.count || 0,
    },
  });
}
