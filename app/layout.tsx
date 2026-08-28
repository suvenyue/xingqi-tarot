import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '星契 Tarot｜听见你心中的答案',
  description: '静心提问，抽取一张或三张塔罗牌，获得属于此刻的象征与指引。',
  openGraph: {
    title: '星契 Tarot｜听见你心中的答案',
    description: '静心提问，抽取一张或三张塔罗牌，获得属于此刻的象征与指引。',
    images: [{ url: '/og.png', width: 1792, height: 938, alt: '星契 Tarot｜听见你心中的答案' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '星契 Tarot｜听见你心中的答案',
    description: '静心提问，抽取一张或三张塔罗牌，获得属于此刻的象征与指引。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
