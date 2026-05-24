import { getSessionCookie, getSession } from '@/lib/auth';
import { generateSlug } from '@/lib/utils';
import { getDbFromRequest } from '@/lib/api-helpers';

type SubmissionRow = {
  id: string;
  user_id: string;
  name: string;
  url: string;
  normalized_domain: string;
  short_summary: string | null;
  full_description: string | null;
};

type IdRow = {
  category_id?: string;
  keyword_id?: string;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDbFromRequest(request);
  if (!db) {
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '数据库未配置' } }, { status: 503 });
  }

  const sessionId = getSessionCookie(request);
  const user = sessionId ? await getSession(db, sessionId) : null;
  if (!user || user.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: '权限不足' } }, { status: 403 });
  }

  const body = await request.json();
  const { action, note } = body;

  if (!['approve', 'reject'].includes(action)) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: 'action 必须为 approve 或 reject' } }, { status: 400 });
  }

  const sub = await db.all<SubmissionRow>(`SELECT * FROM submissions WHERE id = ?`, [id]);
  if (!sub.results?.length) {
    return Response.json({ error: { code: 'NOT_FOUND', message: '投稿不存在' } }, { status: 404 });
  }

  const submission = sub.results[0];
  const now = new Date().toISOString();
  const newStatus = action === 'approve' ? 'approved' : 'rejected';

  await db.run(
    `UPDATE submissions SET status = ?, reviewer_user_id = ?, review_note = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
    [newStatus, user.id, note || null, now, now, id]
  );

  // If approved, create website record
  if (action === 'approve') {
    const websiteId = crypto.randomUUID();
    const slug = generateSlug(submission.name);

    await db.run(
      `INSERT INTO websites (id, name, slug, url, normalized_domain, short_summary, full_description, status, star_rating, view_count, submitter_user_id, approved_by_user_id, approved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, 0, ?, ?, ?, ?, ?)`,
      [websiteId, submission.name, slug, submission.url, submission.normalized_domain, submission.short_summary, submission.full_description, submission.user_id, user.id, now, now, now]
    );

    // Copy category associations
    const cats = await db.all<IdRow>(`SELECT category_id FROM submission_categories WHERE submission_id = ?`, [id]);
    for (const cat of (cats.results || [])) {
      await db.run(`INSERT IGNORE INTO website_categories (website_id, category_id) VALUES (?, ?)`, [websiteId, cat.category_id]);
    }

    // Copy keyword associations
    const kws = await db.all<IdRow>(`SELECT keyword_id FROM submission_keywords WHERE submission_id = ?`, [id]);
    for (const kw of (kws.results || [])) {
      await db.run(`INSERT IGNORE INTO website_keywords (website_id, keyword_id) VALUES (?, ?)`, [websiteId, kw.keyword_id]);
    }
  }

  // Write audit log
  await db.run(
    `INSERT INTO review_logs (id, target_type, target_id, action, reviewer_user_id, reason, created_at) VALUES (?, 'submission', ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), id, action, user.id, note || null, now]
  );

  return Response.json({ data: { id, status: newStatus } });
}
