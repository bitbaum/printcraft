import Link from 'next/link';
import type { ReactNode } from 'react';

/** The one frame around every account screen: the wordmark, a line, the card. */
export function AuthPage({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-6 hero-gradient relative min-h-screen">
      <div className="absolute inset-0 bg-dots opacity-20" />
      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-10">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight mb-2 hover:text-primary transition-colors">
              PrintCraft
            </h1>
          </Link>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-6 sm:p-10">
          {children}
        </div>
      </div>
    </div>
  );
}
