'use client';

import Link from 'next/link';
import { useDictionary } from '@/i18n/dictionary-context';

const POPULAR_TAGS_ZH = [
  { name: 'AI', slug: 'ai', desc: '人工智能相关工具、平台和服务' },
  { name: '免费', slug: '免费', desc: '提供免费版本或免费额度的网站' },
  { name: '开源', slug: '开源', desc: '开源软件、框架和工具' },
  { name: '前端', slug: '前端', desc: '前端开发框架、工具和资源' },
  { name: '后端', slug: '后端', desc: '后端开发、API 和服务端工具' },
  { name: '设计', slug: '设计', desc: 'UI/UX 设计工具和素材' },
  { name: 'SEO', slug: 'seo', desc: '搜索引擎优化工具和分析' },
  { name: '协作', slug: '协作', desc: '团队协作和沟通工具' },
  { name: '自动化', slug: '自动化', desc: '工作流自动化和效率工具' },
  { name: '视频', slug: '视频', desc: '视频平台、编辑和录制工具' },
  { name: '社交', slug: '社交', desc: '社交网络和社区平台' },
  { name: '电商', slug: '电商', desc: '电商平台和在线购物工具' },
  { name: '翻译', slug: '翻译', desc: '在线翻译和多语言工具' },
  { name: 'PDF', slug: 'pdf', desc: 'PDF 编辑、转换和处理工具' },
  { name: '建站', slug: '建站', desc: '网站搭建和 CMS 平台' },
  { name: '搜索', slug: '搜索', desc: '搜索引擎和信息检索工具' },
  { name: '安全', slug: '安全', desc: '网络安全和隐私保护工具' },
  { name: '音乐', slug: '音乐', desc: '音乐平台和音频工具' },
  { name: '图片', slug: '图片', desc: '图片素材、编辑和处理' },
  { name: '项目管理', slug: '项目管理', desc: '项目管理和任务追踪工具' },
  { name: 'API', slug: 'api', desc: 'API 平台、网关和开发工具' },
  { name: '写作', slug: '写作', desc: '写作辅助和内容创作工具' },
  { name: '部署', slug: '部署', desc: '应用部署和 CI/CD 工具' },
];

const POPULAR_TAGS_EN = [
  { name: 'AI', slug: 'ai', desc: 'Artificial intelligence tools, platforms and services' },
  { name: 'Free', slug: '免费', desc: 'Websites offering free plans or credits' },
  { name: 'Open Source', slug: '开源', desc: 'Open source software, frameworks and tools' },
  { name: 'Frontend', slug: '前端', desc: 'Frontend development frameworks and resources' },
  { name: 'Backend', slug: '后端', desc: 'Backend development, APIs and server tools' },
  { name: 'Design', slug: '设计', desc: 'UI/UX design tools and assets' },
  { name: 'SEO', slug: 'seo', desc: 'Search engine optimization tools and analytics' },
  { name: 'Collaboration', slug: '协作', desc: 'Team collaboration and communication tools' },
  { name: 'Automation', slug: '自动化', desc: 'Workflow automation and productivity tools' },
  { name: 'Video', slug: '视频', desc: 'Video platforms, editing and recording tools' },
  { name: 'Social', slug: '社交', desc: 'Social networks and community platforms' },
  { name: 'E-commerce', slug: '电商', desc: 'E-commerce platforms and online shopping tools' },
  { name: 'Translation', slug: '翻译', desc: 'Online translation and multilingual tools' },
  { name: 'PDF', slug: 'pdf', desc: 'PDF editing, conversion and processing tools' },
  { name: 'Website Builder', slug: '建站', desc: 'Website building and CMS platforms' },
  { name: 'Search', slug: '搜索', desc: 'Search engines and information retrieval tools' },
  { name: 'Security', slug: '安全', desc: 'Cybersecurity and privacy protection tools' },
  { name: 'Music', slug: '音乐', desc: 'Music platforms and audio tools' },
  { name: 'Images', slug: '图片', desc: 'Image assets, editing and processing' },
  { name: 'Project Management', slug: '项目管理', desc: 'Project management and task tracking tools' },
  { name: 'API', slug: 'api', desc: 'API platforms, gateways and development tools' },
  { name: 'Writing', slug: '写作', desc: 'Writing assistance and content creation tools' },
  { name: 'Deployment', slug: '部署', desc: 'Application deployment and CI/CD tools' },
];

export default function TagsPage() {
  const { dict, locale } = useDictionary();
  const prefix = `/${locale}`;
  const tags = locale === 'zh-CN' ? POPULAR_TAGS_ZH : POPULAR_TAGS_EN;

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">{dict.tags.title}</h1>
      <p className="text-gray-600 mb-6">{dict.tags.description}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tags.map((tag) => (
          <Link
            key={tag.slug}
            href={`${prefix}/search?q=${encodeURIComponent(tag.name)}`}
            className="block p-4 bg-white border border-gray-200 rounded-md hover:border-blue-300 hover:no-underline"
          >
            <span className="font-medium text-gray-900">{tag.name}</span>
            <p className="text-xs text-gray-500 mt-1">{tag.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
