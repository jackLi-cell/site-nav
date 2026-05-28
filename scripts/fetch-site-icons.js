const fs = require('fs');
const path = require('path');
const { createPoolFromEnv } = require('./mysql-utils');

const STORAGE_DIR = process.env.SITE_ICON_STORAGE_DIR
  ? path.resolve(process.env.SITE_ICON_STORAGE_DIR)
  : path.join(process.cwd(), 'storage', 'site-icons');
const REPORTS_DIR = process.env.SITE_ICON_REPORTS_DIR
  ? path.resolve(process.env.SITE_ICON_REPORTS_DIR)
  : path.join(process.cwd(), 'storage', 'reports', 'site-icons');

const EXTENSION_ORDER = ['png', 'svg', 'ico', 'webp', 'jpg', 'jpeg', 'gif', 'avif'];
const USER_AGENT = process.env.SITE_ICON_USER_AGENT || 'Mozilla/5.0 (compatible; SiteNavIconBot/1.0; +https://nav.jtlcook.com)';
const FETCH_TIMEOUT_MS = Number(process.env.SITE_ICON_FETCH_TIMEOUT_MS || '12000');
const MAX_BYTES = Number(process.env.SITE_ICON_MAX_BYTES || String(1024 * 1024 * 2));

function parseArgs(argv) {
  const options = {
    limit: 200,
    offset: 0,
    concurrency: 6,
    force: false,
    retryFailed: false,
    fallbackService: true,
    region: 'all',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--limit') options.limit = Number(argv[++index] || options.limit);
    else if (arg === '--offset') options.offset = Number(argv[++index] || options.offset);
    else if (arg === '--concurrency') options.concurrency = Number(argv[++index] || options.concurrency);
    else if (arg === '--region') options.region = String(argv[++index] || options.region).trim().toLowerCase();
    else if (arg === '--force') options.force = true;
    else if (arg === '--retry-failed') options.retryFailed = true;
    else if (arg === '--no-fallback-service') options.fallbackService = false;
  }

  options.limit = Math.max(1, options.limit || 200);
  options.offset = Math.max(0, options.offset || 0);
  options.concurrency = Math.max(1, Math.min(16, options.concurrency || 6));
  if (!['all', 'china', 'overseas'].includes(options.region)) {
    throw new Error(`Unsupported --region value: ${options.region}`);
  }
  return options;
}

function sanitizeIconKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function pickExtension(contentType, sourceUrl) {
  const lowerType = String(contentType || '').toLowerCase();
  if (lowerType.includes('image/svg')) return 'svg';
  if (lowerType.includes('image/png')) return 'png';
  if (lowerType.includes('image/webp')) return 'webp';
  if (lowerType.includes('image/jpeg')) return 'jpg';
  if (lowerType.includes('image/gif')) return 'gif';
  if (lowerType.includes('image/avif')) return 'avif';
  if (lowerType.includes('image/x-icon') || lowerType.includes('image/vnd.microsoft.icon')) return 'ico';

  try {
    const pathname = new URL(sourceUrl).pathname.toLowerCase();
    for (const extension of EXTENSION_ORDER) {
      if (pathname.endsWith(`.${extension}`)) {
        return extension;
      }
    }
  } catch {
    return 'png';
  }

  return 'png';
}

function buildCandidateUrls(siteUrl, html) {
  const parsed = new URL(siteUrl);
  const candidates = [
    new URL('/favicon.ico', parsed).toString(),
  ];

  if (html) {
    const links = [];
    const linkRegex = /<link\b[^>]*rel=["']?([^"'>]+)["']?[^>]*href=["']?([^"'>\s]+)["']?[^>]*>/gi;
    let match;
    while ((match = linkRegex.exec(html))) {
      const rel = String(match[1] || '').toLowerCase();
      const href = String(match[2] || '').trim();
      if (!href) continue;
      if (!/(^|[\s-])(icon|apple-touch-icon|mask-icon)([\s-]|$)/.test(rel)) continue;
      try {
        const url = new URL(href, parsed).toString();
        links.push({
          url,
          priority: rel.includes('apple-touch-icon') ? 1 : rel.includes('mask-icon') ? 2 : 3,
        });
      } catch {
        continue;
      }
    }

    links
      .sort((left, right) => left.priority - right.priority)
      .forEach((link) => candidates.push(link.url));
  }

  for (const commonPath of [
    '/apple-touch-icon.png',
    '/favicon.svg',
    '/favicon.png',
    '/favicon-32x32.png',
    '/favicon-192x192.png',
  ]) {
    candidates.push(new URL(commonPath, parsed).toString());
  }

  return [...new Set(candidates)];
}

async function fetchWithTimeout(resource, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(resource, {
      redirect: 'follow',
      ...init,
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtml(siteUrl) {
  try {
    const response = await fetchWithTimeout(siteUrl, {
      headers: {
        'user-agent': USER_AGENT,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!response.ok) return null;
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html')) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function probeWebsiteReachability(siteUrl) {
  const attempts = [
    {
      method: 'HEAD',
      accept: '*/*',
    },
    {
      method: 'GET',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  ];

  for (const attempt of attempts) {
    try {
      const response = await fetchWithTimeout(siteUrl, {
        method: attempt.method,
        headers: {
          'user-agent': USER_AGENT,
          accept: attempt.accept,
        },
      });

      if (response.ok) {
        return {
          reachable: true,
          method: attempt.method,
          status: response.status,
          finalUrl: response.url || siteUrl,
        };
      }

      if ([401, 403, 405].includes(response.status)) {
        return {
          reachable: true,
          method: attempt.method,
          status: response.status,
          finalUrl: response.url || siteUrl,
        };
      }
    } catch (error) {
      if (attempt.method === 'GET') {
        return {
          reachable: false,
          method: attempt.method,
          status: null,
          finalUrl: siteUrl,
          error: error && error.message ? error.message : 'unknown-error',
        };
      }
    }
  }

  return {
    reachable: false,
    method: 'GET',
    status: null,
    finalUrl: siteUrl,
    error: 'unreachable',
  };
}

async function downloadIcon(url) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    return null;
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!buffer.length || buffer.length > MAX_BYTES) {
    return null;
  }

  const extension = pickExtension(contentType, url);
  return {
    bytes: buffer,
    extension,
    mimeType: contentType || `image/${extension}`,
    sourceUrl: response.url || url,
  };
}

function removeExistingIconFiles(iconKey) {
  for (const extension of EXTENSION_ORDER) {
    const filePath = path.join(STORAGE_DIR, `${iconKey}.${extension}`);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  }
}

function findExistingIcon(iconKey) {
  for (const extension of EXTENSION_ORDER) {
    const filePath = path.join(STORAGE_DIR, `${iconKey}.${extension}`);
    if (fs.existsSync(filePath)) {
      return { filePath, extension };
    }
  }
  return null;
}

async function saveIcon(iconKey, asset) {
  ensureDir(STORAGE_DIR);
  removeExistingIconFiles(iconKey);
  const filePath = path.join(STORAGE_DIR, `${iconKey}.${asset.extension}`);
  await fs.promises.writeFile(filePath, asset.bytes);
  return filePath;
}

function formatTimestamp(date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function escapeSqlString(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

async function writeBatchReports(options, reportData) {
  if (!reportData.domesticDeleteCandidates.length && !reportData.overseasReviewCandidates.length) {
    return null;
  }

  ensureDir(REPORTS_DIR);
  const stamp = formatTimestamp();
  const regionSuffix = options.region === 'all' ? 'mixed' : options.region;
  const written = {};

  if (reportData.domesticDeleteCandidates.length) {
    const sqlPath = path.join(REPORTS_DIR, `${stamp}-${regionSuffix}-domestic-unreachable-delete.sql`);
    const lines = [
      '-- Auto-generated by scripts/fetch-site-icons.js',
      `-- Created at: ${new Date().toISOString()}`,
      `-- Batch region: ${options.region}`,
      `-- Candidate count: ${reportData.domesticDeleteCandidates.length}`,
      'START TRANSACTION;',
      '',
    ];

    for (const site of reportData.domesticDeleteCandidates) {
      const siteId = escapeSqlString(site.id);
      const comment = `-- ${site.normalized_domain} | ${site.url} | reachability=${site.reachabilityError || site.reachabilityStatus || 'unknown'}`;
      lines.push(comment);
      lines.push(`DELETE FROM website_categories WHERE website_id = '${siteId}';`);
      lines.push(`DELETE FROM website_keywords WHERE website_id = '${siteId}';`);
      lines.push(`DELETE FROM website_tags WHERE website_id = '${siteId}';`);
      lines.push(`DELETE FROM website_groups WHERE website_id = '${siteId}';`);
      lines.push(`DELETE FROM outbound_click_events WHERE website_id = '${siteId}';`);
      lines.push(`DELETE FROM review_logs WHERE target_type = 'website' AND target_id = '${siteId}';`);
      lines.push(`DELETE FROM websites WHERE id = '${siteId}';`);
      lines.push('');
    }

    lines.push('COMMIT;');
    await fs.promises.writeFile(sqlPath, `${lines.join('\n')}\n`);
    written.domesticDeleteSqlPath = sqlPath;
  }

  if (reportData.overseasReviewCandidates.length) {
    const jsonPath = path.join(REPORTS_DIR, `${stamp}-${regionSuffix}-overseas-unreachable-review.json`);
    await fs.promises.writeFile(
      jsonPath,
      `${JSON.stringify({
        createdAt: new Date().toISOString(),
        region: options.region,
        count: reportData.overseasReviewCandidates.length,
        items: reportData.overseasReviewCandidates,
      }, null, 2)}\n`
    );
    written.overseasReviewJsonPath = jsonPath;
  }

  return written;
}

async function updateIconRecord(pool, websiteId, fields) {
  const now = new Date().toISOString();
  await pool.query(
    `UPDATE websites
     SET icon_path = ?, icon_source_url = ?, icon_mime_type = ?, icon_fetch_status = ?, icon_fetched_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      fields.iconPath || null,
      fields.iconSourceUrl || null,
      fields.iconMimeType || null,
      fields.iconFetchStatus || null,
      fields.iconFetchedAt || now,
      now,
      websiteId,
    ]
  );
}

async function fetchIconForWebsite(site, options) {
  const iconKey = sanitizeIconKey(site.normalized_domain);
  if (!iconKey) {
    return { ok: false, reason: 'invalid-domain', reachability: null };
  }

  const iconRoute = `/site-icons/${encodeURIComponent(iconKey)}`;
  const existing = findExistingIcon(iconKey);
  if (existing && !options.force) {
    return {
      ok: true,
      iconPath: iconRoute,
      iconSourceUrl: site.icon_source_url || site.url,
      iconMimeType: site.icon_mime_type || '',
      reused: true,
      reachability: null,
    };
  }

  const reachability = await probeWebsiteReachability(site.url);
  if (reachability && !reachability.reachable) {
    return { ok: false, reason: 'unreachable', reachability };
  }

  const homepageHtml = await fetchHtml(site.url);
  const candidates = buildCandidateUrls(site.url, homepageHtml);
  if (options.fallbackService) {
    candidates.push(`https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(site.url)}`);
  }

  for (const candidate of candidates) {
    let asset = null;
    try {
      asset = await downloadIcon(candidate);
    } catch {
      asset = null;
    }
    if (!asset) {
      continue;
    }
    await saveIcon(iconKey, asset);
    return {
      ok: true,
      iconPath: iconRoute,
      iconSourceUrl: asset.sourceUrl,
      iconMimeType: asset.mimeType,
      reused: false,
      reachability,
    };
  }

  return { ok: false, reason: 'not-found', reachability };
}

async function runWithConcurrency(items, concurrency, worker) {
  let cursor = 0;
  const results = [];

  async function next() {
    const index = cursor;
    cursor += 1;
    if (index >= items.length) {
      return;
    }
    results[index] = await worker(items[index], index);
    await next();
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureDir(STORAGE_DIR);
  ensureDir(REPORTS_DIR);

  const pool = createPoolFromEnv();
  try {
    const where = ['status = "active"', 'normalized_domain IS NOT NULL', 'normalized_domain <> ""'];
    const params = [];
    if (options.region !== 'all') {
      where.push('region = ?');
      params.push(options.region);
    }
    if (!options.force) {
      if (options.retryFailed) {
        where.push('(icon_fetch_status IS NULL OR icon_fetch_status <> "success")');
      } else {
        where.push('(icon_fetch_status IS NULL OR icon_fetch_status = "" OR icon_fetch_status = "pending")');
      }
    }

    const [rows] = await pool.query(
      `SELECT id, name, url, normalized_domain, region, icon_path, icon_source_url, icon_mime_type, icon_fetch_status
       FROM websites
       WHERE ${where.join(' AND ')}
       ORDER BY id
       LIMIT ? OFFSET ?`,
      [...params, options.limit, options.offset]
    );

    if (!rows.length) {
      console.log('[icons:fetch] no websites matched current batch.');
      return;
    }

    console.log(`[icons:fetch] batch size=${rows.length}, offset=${options.offset}, concurrency=${options.concurrency}`);
    let successCount = 0;
    let failedCount = 0;
    let reusedCount = 0;
    const domesticDeleteCandidates = [];
    const overseasReviewCandidates = [];
    const isDynamicPendingQueue = !options.force;

    await runWithConcurrency(rows, options.concurrency, async (site, index) => {
      try {
        const result = await fetchIconForWebsite(site, options);
        if (result.ok) {
          await updateIconRecord(pool, site.id, {
            iconPath: result.iconPath,
            iconSourceUrl: result.iconSourceUrl,
            iconMimeType: result.iconMimeType,
            iconFetchStatus: 'success',
            iconFetchedAt: new Date().toISOString(),
          });
          successCount += 1;
          if (result.reused) reusedCount += 1;
          console.log(`[icons:fetch] ok ${index + 1}/${rows.length} ${site.normalized_domain}${result.reused ? ' (reused)' : ''}`);
          return;
        }

        if (result.reachability && !result.reachability.reachable) {
          const candidate = {
            id: site.id,
            name: site.name,
            url: site.url,
            normalized_domain: site.normalized_domain,
            region: site.region,
            reachabilityStatus: result.reachability.status,
            reachabilityError: result.reachability.error || null,
            checkedAt: new Date().toISOString(),
          };
          if (site.region === 'china') {
            domesticDeleteCandidates.push(candidate);
          } else if (site.region === 'overseas') {
            overseasReviewCandidates.push(candidate);
          }
        }

        await updateIconRecord(pool, site.id, {
          iconPath: null,
          iconSourceUrl: null,
          iconMimeType: null,
          iconFetchStatus: 'failed',
          iconFetchedAt: new Date().toISOString(),
        });
        failedCount += 1;
        const reachabilityNote = result.reachability && !result.reachability.reachable
          ? ` unreachable=${result.reachability.error || result.reachability.status || 'yes'}`
          : '';
        console.log(`[icons:fetch] miss ${index + 1}/${rows.length} ${site.normalized_domain} ${result.reason}${reachabilityNote}`);
      } catch (error) {
        await updateIconRecord(pool, site.id, {
          iconPath: null,
          iconSourceUrl: null,
          iconMimeType: null,
          iconFetchStatus: 'failed',
          iconFetchedAt: new Date().toISOString(),
        });
        failedCount += 1;
        console.log(`[icons:fetch] error ${index + 1}/${rows.length} ${site.normalized_domain} ${error.message}`);
      }
    });

    const writtenReports = await writeBatchReports(options, {
      domesticDeleteCandidates,
      overseasReviewCandidates,
    });

    console.log(JSON.stringify({
      batch: rows.length,
      region: options.region,
      success: successCount,
      failed: failedCount,
      reused: reusedCount,
      domesticDeleteCandidates: domesticDeleteCandidates.length,
      overseasReviewCandidates: overseasReviewCandidates.length,
      reports: writtenReports,
      storageDir: STORAGE_DIR,
      nextOffset: isDynamicPendingQueue ? 0 : options.offset + rows.length,
      nextCommandHint: isDynamicPendingQueue
        ? 'For pending/failed queue processing, keep --offset 0 on the next run.'
        : `Use --offset ${options.offset + rows.length} for the next batch if you want to continue the current ordered scan.`,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[icons:fetch] failed:', error);
  process.exitCode = 1;
});
