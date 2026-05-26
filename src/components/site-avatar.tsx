'use client';

import { useMemo, useState } from 'react';
import { resolveSiteIconUrl } from '@/lib/site-icons';

interface SiteAvatarProps {
  name: string;
  normalizedDomain?: string | null;
  iconPath?: string | null;
  className?: string;
  labelClassName?: string;
}

export function SiteAvatar({
  name,
  normalizedDomain,
  iconPath,
  className = 'w-14 h-14 rounded-xl',
  labelClassName = 'text-xl font-bold',
}: SiteAvatarProps) {
  const [failed, setFailed] = useState(false);
  const fallbackLabel = useMemo(() => name.trim().charAt(0).toUpperCase() || '?', [name]);
  const src = useMemo(() => (failed ? null : resolveSiteIconUrl(iconPath, normalizedDomain)), [failed, iconPath, normalizedDomain]);

  return (
    <div className={`${className} bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0`}>
      {src ? (
        <img
          src={src}
          alt={`${name} icon`}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={`${labelClassName} text-gray-300`}>{fallbackLabel}</span>
      )}
    </div>
  );
}
