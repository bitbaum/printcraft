import type { Metadata } from 'next';
import Script from 'next/script';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'PrintCraft — Scene Composer for Physical Art',
  description:
    'Turn separate photos of real people into one unified artwork — printed on surfaces that matter.',
  // Where the site ACTUALLY serves. printcraft.app does not serve this app, so
  // the generated og:image resolved to https://printcraft.app/opengraph-image
  // and 404'd — the preview was advertised and discarded by every scraper.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://printcraft.orangecat.ch'),
  openGraph: {
    title: 'PrintCraft — Scene Composer for Physical Art',
    description:
      'Turn separate photos of real people into one unified artwork — printed on surfaces that matter.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'PrintCraft' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PrintCraft — Scene Composer for Physical Art',
    description:
      'Turn separate photos of real people into one unified artwork — printed on surfaces that matter.',
    images: ['/og-image.png'],
  },
  other: {
    'theme-color': '#1a1a1a',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
        <Toaster theme="dark" />

        {/* FleetCrown feedback widget — env-gated, see docs/architecture/feedback-widget.md */}
        {process.env.NEXT_PUBLIC_FC_WIDGET_TOKEN && (
          <Script
            src="https://fleetcrown.orangecat.ch/widget.js"
            strategy="afterInteractive"
            data-fc-project={process.env.NEXT_PUBLIC_FC_WIDGET_TOKEN}
          />
        )}
      </body>
    </html>
  );
}
