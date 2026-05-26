import {
  boolean,
  bigint,
  index,
  int,
  mysqlTable,
  primaryKey,
  text,
  varchar,
} from 'drizzle-orm/mysql-core';

// ============ Users ============

export const users = mysqlTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  role: varchar('role', { length: 20, enum: ['user', 'editor', 'admin'] }).default('user').notNull(),
  contributionScore: int('contribution_score').default(0).notNull(),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  updatedAt: varchar('updated_at', { length: 32 }).notNull(),
}, (table) => ({
  roleIdx: index('idx_users_role').on(table.role),
}));

// ============ Sessions ============

export const sessions = mysqlTable('sessions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  expiresAt: varchar('expires_at', { length: 32 }).notNull(),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
}, (table) => ({
  userIdx: index('idx_sessions_user').on(table.userId),
  expiresIdx: index('idx_sessions_expires').on(table.expiresAt),
}));

// ============ Websites ============

export const websites = mysqlTable('websites', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  url: varchar('url', { length: 2048 }).notNull(),
  normalizedDomain: varchar('normalized_domain', { length: 255 }).notNull(),
  shortSummary: varchar('short_summary', { length: 500 }),
  fullDescription: text('full_description'),
  status: varchar('status', { length: 20, enum: ['active', 'inactive', 'removed'] }).default('active').notNull(),
  region: varchar('region', { length: 20 }).default('china').notNull(),
  starRating: int('star_rating').default(1).notNull(),
  viewCount: int('view_count').default(0).notNull(),
  monthlyVisits: bigint('monthly_visits', { mode: 'number' }).default(0),
  company: varchar('company', { length: 255 }),
  founder: varchar('founder', { length: 255 }),
  headquarters: varchar('headquarters', { length: 255 }),
  language: varchar('language', { length: 80 }),
  isFree: varchar('is_free', { length: 40 }),
  launchYear: int('launch_year'),
  pricingModel: varchar('pricing_model', { length: 255 }),
  alternatives: text('alternatives'),
  targetAudience: text('target_audience'),
  features: text('features'),
  platforms: text('platforms'),
  socialLinks: text('social_links'),
  iconPath: varchar('icon_path', { length: 512 }),
  iconSourceUrl: varchar('icon_source_url', { length: 2048 }),
  iconMimeType: varchar('icon_mime_type', { length: 120 }),
  iconFetchStatus: varchar('icon_fetch_status', { length: 20 }),
  iconFetchedAt: varchar('icon_fetched_at', { length: 32 }),
  screenshotUrl: varchar('screenshot_url', { length: 2048 }),
  screenshotAt: varchar('screenshot_at', { length: 32 }),
  lastHealthCheck: varchar('last_health_check', { length: 32 }),
  consecutiveFailures: int('consecutive_failures').default(0),
  submitterUserId: varchar('submitter_user_id', { length: 64 }),
  approvedByUserId: varchar('approved_by_user_id', { length: 64 }),
  approvedAt: varchar('approved_at', { length: 32 }),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  updatedAt: varchar('updated_at', { length: 32 }).notNull(),
}, (table) => ({
  slugIdx: index('idx_websites_slug').on(table.slug),
  domainIdx: index('idx_websites_domain').on(table.normalizedDomain),
  regionStatusIdx: index('idx_websites_region_status').on(table.region, table.status),
  sortIdx: index('idx_websites_sort').on(table.status, table.region, table.viewCount, table.name),
  createdIdx: index('idx_websites_created').on(table.status, table.region, table.createdAt),
  starIdx: index('idx_websites_star').on(table.status, table.region, table.starRating, table.viewCount),
}));

// ============ Categories ============

export const categories = mysqlTable('categories', {
  id: varchar('id', { length: 128 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: varchar('description', { length: 500 }),
  icon: varchar('icon', { length: 32 }),
  parentId: varchar('parent_id', { length: 128 }),
  level: int('level').default(1).notNull(),
  sortOrder: int('sort_order').default(0).notNull(),
  websiteCount: int('website_count').default(0).notNull(),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
}, (table) => ({
  slugIdx: index('idx_categories_slug').on(table.slug),
  parentIdx: index('idx_categories_parent').on(table.parentId),
  levelIdx: index('idx_categories_level').on(table.level, table.sortOrder),
}));

// ============ Website Categories（多对多） ============

export const websiteCategories = mysqlTable('website_categories', {
  websiteId: varchar('website_id', { length: 64 }).notNull(),
  categoryId: varchar('category_id', { length: 128 }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.websiteId, table.categoryId] }),
  websiteIdx: index('idx_wc_website').on(table.websiteId),
  categoryIdx: index('idx_wc_category').on(table.categoryId),
}));

// ============ Keywords ============

export const keywords = mysqlTable('keywords', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  normalized: varchar('normalized', { length: 255 }).notNull(),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
}, (table) => ({
  normalizedIdx: index('idx_keywords_normalized').on(table.normalized),
}));

// ============ Website Keywords（多对多） ============

export const websiteKeywords = mysqlTable('website_keywords', {
  websiteId: varchar('website_id', { length: 64 }).notNull(),
  keywordId: varchar('keyword_id', { length: 64 }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.websiteId, table.keywordId] }),
  websiteIdx: index('idx_wk_website').on(table.websiteId),
  keywordIdx: index('idx_wk_keyword').on(table.keywordId),
}));

// ============ Tags（运营标签：热门/推荐/新上线/必备） ============

export const tags = mysqlTable('tags', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  color: varchar('color', { length: 16 }),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
});

// ============ Website Tags（多对多） ============

export const websiteTags = mysqlTable('website_tags', {
  websiteId: varchar('website_id', { length: 64 }).notNull(),
  tagId: varchar('tag_id', { length: 64 }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.websiteId, table.tagId] }),
  websiteIdx: index('idx_wt_website').on(table.websiteId),
  tagIdx: index('idx_wt_tag').on(table.tagId),
}));

// ============ Groups（专题集合，v0.3） ============

export const groups = mysqlTable('groups', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  coverImage: varchar('cover_image', { length: 2048 }),
  sortOrder: int('sort_order').default(0).notNull(),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
});

// ============ Website Groups（多对多） ============

export const websiteGroups = mysqlTable('website_groups', {
  websiteId: varchar('website_id', { length: 64 }).notNull(),
  groupId: varchar('group_id', { length: 64 }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.websiteId, table.groupId] }),
}));

// ============ Submissions ============

export const submissions = mysqlTable('submissions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  url: varchar('url', { length: 2048 }).notNull(),
  normalizedDomain: varchar('normalized_domain', { length: 255 }).notNull(),
  shortSummary: varchar('short_summary', { length: 500 }),
  fullDescription: text('full_description'),
  region: varchar('region', { length: 20 }).default('china'),
  company: varchar('company', { length: 255 }),
  language: varchar('language', { length: 80 }),
  isFree: varchar('is_free', { length: 40 }),
  status: varchar('status', { length: 20, enum: ['queued', 'auto_flagged', 'in_review', 'approved', 'rejected'] }).default('queued').notNull(),
  flagReason: text('flag_reason'),
  reviewerUserId: varchar('reviewer_user_id', { length: 64 }),
  reviewNote: text('review_note'),
  reviewedAt: varchar('reviewed_at', { length: 32 }),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
  updatedAt: varchar('updated_at', { length: 32 }).notNull(),
}, (table) => ({
  userStatusIdx: index('idx_submissions_user_status').on(table.userId, table.status),
  statusDateIdx: index('idx_submissions_status_date').on(table.status, table.createdAt),
}));

// ============ Submission Categories ============

export const submissionCategories = mysqlTable('submission_categories', {
  submissionId: varchar('submission_id', { length: 64 }).notNull(),
  categoryId: varchar('category_id', { length: 128 }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.submissionId, table.categoryId] }),
}));

// ============ Submission Keywords ============

export const submissionKeywords = mysqlTable('submission_keywords', {
  submissionId: varchar('submission_id', { length: 64 }).notNull(),
  keywordId: varchar('keyword_id', { length: 64 }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.submissionId, table.keywordId] }),
}));

// ============ Review Logs ============

export const reviewLogs = mysqlTable('review_logs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  targetType: varchar('target_type', { length: 20, enum: ['submission', 'website'] }).notNull(),
  targetId: varchar('target_id', { length: 64 }).notNull(),
  action: varchar('action', { length: 20, enum: ['approve', 'reject', 'edit', 'remove', 'restore'] }).notNull(),
  reviewerUserId: varchar('reviewer_user_id', { length: 64 }).notNull(),
  beforeSnapshot: text('before_snapshot'),
  afterSnapshot: text('after_snapshot'),
  reason: text('reason'),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
}, (table) => ({
  targetIdx: index('idx_review_logs_target').on(table.targetType, table.targetId, table.createdAt),
}));

// ============ Outbound Click Events ============

export const outboundClickEvents = mysqlTable('outbound_click_events', {
  id: varchar('id', { length: 64 }).primaryKey(),
  websiteId: varchar('website_id', { length: 64 }).notNull(),
  ipHash: varchar('ip_hash', { length: 128 }).notNull(),
  uaHash: varchar('ua_hash', { length: 128 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  isValid: boolean('is_valid').default(true).notNull(),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
}, (table) => ({
  websiteDateIdx: index('idx_clicks_website_date').on(table.websiteId, table.createdAt),
  userDedupIdx: index('idx_clicks_dedup_user').on(table.userId, table.websiteId, table.createdAt),
  ipDedupIdx: index('idx_clicks_dedup_ip').on(table.ipHash, table.uaHash, table.websiteId, table.createdAt),
}));

// ============ Moderation Results ============

export const moderationResults = mysqlTable('moderation_results', {
  id: varchar('id', { length: 64 }).primaryKey(),
  submissionId: varchar('submission_id', { length: 64 }).notNull(),
  checkType: varchar('check_type', { length: 40, enum: ['url_format', 'keyword_blocklist', 'domain_duplicate', 'spam_detect'] }).notNull(),
  passed: boolean('passed').notNull(),
  detail: text('detail'),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
});

// ============ Site Health Checks（v0.3） ============

export const siteHealthChecks = mysqlTable('site_health_checks', {
  id: varchar('id', { length: 64 }).primaryKey(),
  websiteId: varchar('website_id', { length: 64 }).notNull(),
  statusCode: int('status_code').notNull(),
  createdAt: varchar('created_at', { length: 32 }).notNull(),
}, (table) => ({
  websiteIdx: index('idx_health_checks_website').on(table.websiteId, table.createdAt),
}));
