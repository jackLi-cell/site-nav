export function WebsiteJsonLd({ site, appUrl }: { site: any; appUrl: string }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: site.name,
    description: site.shortSummary,
    url: `${appUrl}/sites/${site.slug}`,
    mainEntity: {
      '@type': 'WebSite',
      name: site.name,
      url: site.url,
      description: site.shortSummary,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: appUrl },
        { '@type': 'ListItem', position: 2, name: '全部网站', item: `${appUrl}/sites` },
        { '@type': 'ListItem', position: 3, name: site.name, item: `${appUrl}/sites/${site.slug}` },
      ],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function CategoryJsonLd({ category, appUrl }: { category: any; appUrl: string }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${category.name}网站推荐`,
    description: category.description || `精选${category.name}类网站导航，按热度排序。`,
    url: `${appUrl}/categories/${category.slug}`,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: appUrl },
        { '@type': 'ListItem', position: 2, name: '分类', item: `${appUrl}/categories` },
        { '@type': 'ListItem', position: 3, name: category.name, item: `${appUrl}/categories/${category.slug}` },
      ],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function HomeJsonLd({ appUrl }: { appUrl: string }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '网站收录导航',
    url: appUrl,
    description: '精选网站收录与分类导航平台，发现优质网站资源。',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${appUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
