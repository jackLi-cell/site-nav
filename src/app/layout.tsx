import type { Metadata } from 'next';

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
