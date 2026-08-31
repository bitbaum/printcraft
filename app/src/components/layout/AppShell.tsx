'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LogOut, Menu, X, User } from 'lucide-react';
import type { ReactNode } from 'react';

const NAV_LINKS = [
  { href: '/projects', label: 'Projects' },
  { href: '/#how-it-works', label: 'How It Works' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile menu on route change. Adjusting state during render with a
  // remembered previous value (React "you might not need an effect") avoids the
  // cascading re-render an effect-driven setState would trigger.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileMenuOpen(false);
  }

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex flex-col min-h-full">
      <header
        className={cn(
          'sticky top-0 z-50 transition-all duration-300',
          scrolled
            ? 'glass-strong border-b border-white/[0.06] shadow-lg shadow-black/10'
            : 'bg-transparent',
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 sm:px-6 md:px-8 max-w-7xl mx-auto w-full">
          {/* Logo */}
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-foreground hover:text-primary transition-colors"
          >
            PrintCraft
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                // The comparison below already knows which link is the page you
                // are on; it only painted it. Announce it too, or the highlight
                // exists solely for people who can see it.
                aria-current={pathname === link.href ? 'page' : undefined}
                className={cn(
                  // min-h-11 is the 44px touch floor. py-2 on text-sm came out
                  // near 36px, which is a fiddly target on a phone.
                  'inline-flex min-h-11 items-center px-4 py-2 text-sm font-medium rounded-full transition-colors',
                  pathname === link.href
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04]">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm text-muted-foreground max-w-32 truncate">
                    {user.email?.split('@')[0]}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground rounded-full h-8 w-8 p-0"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Link href="/login" className="hidden md:block">
                <Button variant="ghost" size="sm" className="text-sm rounded-full">
                  Sign in
                </Button>
              </Link>
            )}

            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="sm"
              // h-10 w-10 was 40px — under the 44px floor, on the one control a
              // phone user must hit to reach any other page.
              className="md:hidden h-11 w-11 p-0"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Glow line */}
        <div
          className={cn(
            'h-px glow-line transition-opacity duration-300',
            scrolled ? 'opacity-100' : 'opacity-0',
          )}
        />
      </header>

      {/* Full-screen mobile menu overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 md:hidden transition-all duration-300',
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      >
        <div className="absolute inset-0 bg-background/95 backdrop-blur-xl" />
        <div className="relative flex flex-col items-center justify-center h-full gap-2 px-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
              className={cn(
                'w-full max-w-sm text-center px-6 py-5 text-xl font-medium rounded-2xl transition-colors',
                pathname === link.href
                  ? 'text-foreground bg-white/[0.06]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}

          <div className="w-full max-w-sm h-px bg-white/[0.06] my-4" />

          {user ? (
            <>
              <div className="flex items-center gap-3 px-6 py-4 text-muted-foreground">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <span className="text-base">{user.email?.split('@')[0]}</span>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full max-w-sm text-center px-6 py-5 text-xl font-medium text-muted-foreground hover:text-foreground rounded-2xl hover:bg-white/[0.04] transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="w-full max-w-sm text-center px-6 py-5 text-xl font-medium text-primary hover:text-foreground rounded-2xl hover:bg-white/[0.04] transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
