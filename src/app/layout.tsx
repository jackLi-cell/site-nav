import type { Metadata } from 'next';

export const metadata: Metadata = {
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
