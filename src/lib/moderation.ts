const BLOCKED_KEYWORDS = [
  '色情', '赌博', '博彩', '赌场', '约炮',
  '诈骗', '日赚', '躺赚', '保本', '稳赚',
  '外挂', '破解', '激活码', '私服',
  '钓鱼', '恶意软件', '木马', '病毒',
];

const SUSPICIOUS_TLDS = ['.xyz', '.top', '.club', '.buzz', '.icu', '.tk', '.ml', '.ga', '.cf'];

const SHORT_LINK_DOMAINS = ['bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'is.gd', 'v.gd'];

export interface ModerationCheck {
  checkType: 'url_format' | 'keyword_blocklist' | 'domain_duplicate' | 'spam_detect';
  passed: boolean;
  detail: string;
}

export function checkUrlFormat(url: string): ModerationCheck {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { checkType: 'url_format', passed: false, detail: '不支持的协议' };
    }
    const domain = parsed.hostname.toLowerCase();
    if (SHORT_LINK_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d))) {
      return { checkType: 'url_format', passed: false, detail: '短链域名需提供原始地址' };
    }
    const hasSuspiciousTld = SUSPICIOUS_TLDS.some((tld) => domain.endsWith(tld));
    if (hasSuspiciousTld) {
      return { checkType: 'url_format', passed: false, detail: `可疑后缀域名，需人工复核` };
    }
    return { checkType: 'url_format', passed: true, detail: 'URL 格式正常' };
  } catch {
    return { checkType: 'url_format', passed: false, detail: 'URL 格式无效' };
  }
}

export function checkKeywordBlocklist(text: string): ModerationCheck {
  const lower = text.toLowerCase();
  const found = BLOCKED_KEYWORDS.filter((kw) => lower.includes(kw));
  if (found.length > 0) {
    return {
      checkType: 'keyword_blocklist',
      passed: false,
      detail: `命中高风险词：${found.join(', ')}`,
    };
  }
  return { checkType: 'keyword_blocklist', passed: true, detail: '未命中高风险词' };
}

export function checkSpam(name: string, summary: string): ModerationCheck {
  if (name.length > 50 && name.split(/[,，、|]/).length > 5) {
    return { checkType: 'spam_detect', passed: false, detail: '名称疑似堆砌关键词' };
  }
  if (summary && summary.length > 100) {
    const words = summary.split(/\s+/);
    const unique = new Set(words);
    if (unique.size < words.length * 0.3) {
      return { checkType: 'spam_detect', passed: false, detail: '简介疑似重复堆词' };
    }
  }
  return { checkType: 'spam_detect', passed: true, detail: '未检测到垃圾内容特征' };
}

export function runModeration(
  url: string,
  name: string,
  summary: string
): ModerationCheck[] {
  return [
    checkUrlFormat(url),
    checkKeywordBlocklist(`${name} ${summary}`),
    checkSpam(name, summary),
  ];
}
