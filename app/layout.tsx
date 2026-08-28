import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '星契 Tarot｜完整78张韦特塔罗',
  description: '完整78张韦特体系，包含正逆位、爱情、事业、财运、健康与牌阵位置的详细中文解读。',
  openGraph: {
    title: '星契 Tarot｜完整78张韦特塔罗',
    description: '完整78张韦特体系，包含正逆位、爱情、事业、财运、健康与牌阵位置的详细中文解读。',
    images: [{ url: '/og.png', width: 1792, height: 938, alt: '星契 Tarot｜听见你心中的答案' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '星契 Tarot｜完整78张韦特塔罗',
    description: '完整78张韦特体系，包含正逆位、爱情、事业、财运、健康与牌阵位置的详细中文解读。',
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
