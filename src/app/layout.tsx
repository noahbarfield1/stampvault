import '@/styles/globals.css';
import type { Metadata } from 'next';
import { Inter, Playfair_Display, JetBrains_Mono } from 'next/font/google';
import { AppShell } from '@/components/layout/AppShell';
import AnimatedBackground from '@/components/layout/AnimatedBackground';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'PerdueStampVault | AI-Powered Stamp Collection',
  description:
    'Premium AI-powered stamp identification, cataloging, and price tracking application',
  keywords: 'stamps, philately, collection, identification, pricing, AI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${playfair.variable} ${jetbrains.variable}`}>
      <body>
        <AnimatedBackground />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
