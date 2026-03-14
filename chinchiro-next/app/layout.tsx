import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'チンチロ',
  description: 'スマホ向けチンチロアプリ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
