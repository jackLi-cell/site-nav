import { z } from 'zod';

export const submissionSchema = z.object({
  name: z.string().min(2).max(100),
  url: z.string().url().refine(
    (url) => url.startsWith('http://') || url.startsWith('https://'),
    { message: '仅支持 http 或 https 协议' }
  ),
  shortSummary: z.string().min(10).max(200),
  fullDescription: z.string().max(2000).optional(),
  categoryIds: z.array(z.string()).min(1).max(5),
  keywords: z.array(z.string().max(30)).max(10).optional(),
  groupIds: z.array(z.string()).max(3).optional(),
  turnstileToken: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  turnstileToken: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(50),
  turnstileToken: z.string().min(1),
});

export const websiteAdminSchema = z.object({
  name: z.string().min(2).max(100),
  url: z.string().url(),
  shortSummary: z.string().max(200).optional(),
  fullDescription: z.string().max(2000).optional(),
  status: z.enum(['active', 'inactive', 'removed']).optional(),
  categoryIds: z.array(z.string()).optional(),
  keywordIds: z.array(z.string()).optional(),
  groupIds: z.array(z.string()).optional(),
});

export const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().max(500).optional(),
  editedName: z.string().max(100).optional(),
  editedSummary: z.string().max(200).optional(),
  categoryIds: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
});
