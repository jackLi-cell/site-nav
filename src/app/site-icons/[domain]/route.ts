import { access, readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import {
  SITE_ICON_EXTENSIONS,
  getSiteIconMimeTypeByExtension,
  getSiteIconStorageDir,
  sanitizeSiteIconKey,
} from '@/lib/site-icons';

async function resolveSiteIconFile(domain: string) {
  const iconKey = sanitizeSiteIconKey(domain);
  if (!iconKey) {
    return null;
  }

  const storageDir = getSiteIconStorageDir();
  for (const extension of SITE_ICON_EXTENSIONS) {
    const filePath = path.join(storageDir, `${iconKey}.${extension}`);
    try {
      await access(filePath);
      return { filePath, extension };
    } catch {
      continue;
    }
  }

  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  void request;
  const { domain } = await params;
  const resolved = await resolveSiteIconFile(decodeURIComponent(domain));
  if (!resolved) {
    return new NextResponse('Not found', { status: 404 });
  }

  const content = await readFile(resolved.filePath);
  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': getSiteIconMimeTypeByExtension(resolved.extension),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
