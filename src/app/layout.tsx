import '@/styles/globals.css';
import type { Metadata, Viewport } from 'next';
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

/**
 * Without an explicit viewport export, Next emits only
 * `width=device-width, initial-scale=1`. That omits `viewport-fit=cover`, which
 * means every `env(safe-area-inset-*)` in the stylesheets resolves to 0 — so the
 * bottom tab bar sits under the iPhone home indicator and the fullscreen image
 * close button sits under the notch.
 *
 * `maximumScale` and `userScalable` are deliberately left at their defaults:
 * blocking pinch-zoom fails WCAG 2.1 SC 1.4.4.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#050508',
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
