'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { useDictionary } from '@/i18n/dictionary-context';

export type Region = 'china' | 'overseas';

const RegionContext = createContext<{
  region: Region;
  setRegion: (r: Region) => void;
}>({ region: 'china', setRegion: () => {} });

export function useRegion() {
  return useContext(RegionContext);
}

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [region, setRegionState] = useState<Region>('china');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem('site-nav-region')) as Region | null;
    if (saved === 'china' || saved === 'overseas') {
      setRegionState(saved);
    }
    setMounted(true);
  }, []);

  const setRegion = (r: Region) => {
    setRegionState(r);
    if (typeof window !== 'undefined') {
      localStorage.setItem('site-nav-region', r);
    }
  };

  return (
    <RegionContext.Provider value={{ region, setRegion }}>
      {children}
    </RegionContext.Provider>
  );
}

export function RegionSwitcher() {
  const { region, setRegion } = useRegion();
  const { dict } = useDictionary();
  return (
    <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-xs">
      <button
        onClick={() => setRegion('china')}
        className={`px-3 py-1 ${region === 'china' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
      >
        {dict.region.china}
      </button>
      <button
        onClick={() => setRegion('overseas')}
        className={`px-3 py-1 ${region === 'overseas' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
      >
        {dict.region.overseas}
      </button>
    </div>
  );
}
