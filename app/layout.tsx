import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '星契 Tarot｜78张牌与7种经典牌阵',
  description: '完整78张韦特体系与7种牌阵，包含凯尔特十字、感情、决策、事业、年度十二宫和详细中文解读。',
  openGraph: {
    title: '星契 Tarot｜78张牌与7种经典牌阵',
    description: '完整78张韦特体系与7种牌阵，包含凯尔特十字、感情、决策、事业、年度十二宫和详细中文解读。',
    images: [{ url: '/og.png', width: 1792, height: 938, alt: '星契 Tarot｜听见你心中的答案' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '星契 Tarot｜78张牌与7种经典牌阵',
    description: '完整78张韦特体系与7种牌阵，包含凯尔特十字、感情、决策、事业、年度十二宫和详细中文解读。',
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
