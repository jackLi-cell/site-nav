import { categories } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { getDbFromRequest } from '@/lib/api-helpers';
import { readFileSync } from 'fs';
import { join } from 'path';

let _catsCache: any[] | null = null;
function getCatsData() {
  if (!_catsCache) _catsCache = JSON.parse(readFileSync(join(process.cwd(), 'src/data-categories.json'), 'utf-8'));
  return _catsCache!;
}

export async function GET(request: Request) {
  const db = getDbFromRequest(request);

  if (!db) {
    return Response.json({ data: getCatsData() });
  }

  const allCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      icon: categories.icon,
      parentId: categories.parentId,
      parent_id: categories.parentId,
      level: categories.level,
      sortOrder: categories.sortOrder,
      sort_order: categories.sortOrder,
      websiteCount: categories.websiteCount,
      website_count: categories.websiteCount,
      createdAt: categories.createdAt,
      created_at: categories.createdAt,
    })
    .from(categories)
    .orderBy(asc(categories.level), asc(categories.sortOrder), asc(categories.name));

  return Response.json({ data: allCategories });
}
